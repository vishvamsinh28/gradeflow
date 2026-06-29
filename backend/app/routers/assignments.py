from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_assignment, owned_class
from app.models.schemas import AssignmentCreate, AssignmentStatusUpdate, AssignmentUpdate
from app.services.audit import log_audit
from app.services.storage import SubmissionStorage
from app.workflows.grading import GradingWorkflow

router = APIRouter(tags=["assignments"])


@router.post("/classes/{class_id}/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    class_id: str,
    payload: AssignmentCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_class(db, class_id, user["id"])
    response = db.table("assignments").insert({"class_id": class_id, **payload.model_dump()}).execute()
    return response.data[0]


@router.get("/assignments/{assignment_id}")
def get_assignment(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    assignment = owned_assignment(db, assignment_id, user["id"])
    students = db.table("students").select("*").eq("class_id", assignment["class_id"]).order("name").execute().data
    return {**assignment, "students": students}


@router.patch("/assignments/{assignment_id}/status")
def update_assignment_status(
    assignment_id: str,
    payload: AssignmentStatusUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    response = db.table("assignments").update({"status": payload.status}).eq("id", assignment_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.status_updated",
        details={"status": payload.status},
    )
    return response.data[0]


@router.patch("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: str,
    payload: AssignmentUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    current = owned_assignment(db, assignment_id, user["id"])
    update = payload.model_dump(exclude={"change_note"})
    response = db.table("assignments").update(update).eq("id", assignment_id).execute()
    updated = response.data[0]
    versions = (
        db.table("assignment_versions")
        .select("version_number")
        .eq("assignment_id", assignment_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
        .data
    )
    version_number = (versions[0]["version_number"] if versions else 0) + 1
    db.table("assignment_versions").insert(
        {
            "assignment_id": assignment_id,
            "created_by": user["id"],
            "version_number": version_number,
            "title": updated["title"],
            "description": updated.get("description"),
            "total_points": updated["total_points"],
            "answer_key": updated["answer_key"],
            "rubric": updated["rubric"],
            "change_note": payload.change_note,
        }
    ).execute()
    rubric_changed = current["answer_key"] != updated["answer_key"] or current["rubric"] != updated["rubric"] or current["total_points"] != updated["total_points"]
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.updated",
        details={"version_number": version_number, "rubric_changed": rubric_changed, "change_note": payload.change_note},
    )
    return {**updated, "version_number": version_number, "rubric_changed": rubric_changed}


@router.get("/assignments/{assignment_id}/history")
def assignment_history(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    versions = (
        db.table("assignment_versions")
        .select("*")
        .eq("assignment_id", assignment_id)
        .order("version_number", desc=True)
        .execute()
        .data
    )
    logs = (
        db.table("audit_logs")
        .select("*")
        .eq("owner_id", user["id"])
        .eq("entity_type", "assignment")
        .eq("entity_id", assignment_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
    )
    return {"versions": versions, "audit_logs": logs}


@router.post("/assignments/{assignment_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_assignment(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    assignment = owned_assignment(db, assignment_id, user["id"])
    payload = {
        "class_id": assignment["class_id"],
        "title": f"{assignment['title']} copy",
        "description": assignment.get("description"),
        "total_points": assignment["total_points"],
        "answer_key": assignment["answer_key"],
        "rubric": assignment["rubric"],
        "status": "draft",
    }
    response = db.table("assignments").insert(payload).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=response.data[0]["id"],
        action="assignment.duplicated",
        details={"source_assignment_id": assignment_id},
    )
    return response.data[0]


@router.post("/assignments/{assignment_id}/bulk-approve")
def bulk_approve_assignment(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    now = datetime.now(timezone.utc).isoformat()
    response = (
        db.table("submissions")
        .update({"status": "completed", "review_required": False, "reviewed_at": now, "updated_at": now})
        .eq("assignment_id", assignment_id)
        .eq("review_required", False)
        .in_("status", ["completed", "review_required"])
        .execute()
    )
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.bulk_approved",
        details={"approved": len(response.data)},
    )
    return {"approved": len(response.data)}


@router.post("/assignments/{assignment_id}/return-results")
def return_assignment_results(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    pending_reviews = (
        db.table("submissions")
        .select("id")
        .eq("assignment_id", assignment_id)
        .eq("review_required", True)
        .limit(1)
        .execute()
        .data
    )
    if pending_reviews:
        raise HTTPException(status_code=400, detail="Resolve review-required submissions before returning results")
    response = db.table("assignments").update({"status": "returned"}).eq("id", assignment_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.returned",
        details={},
    )
    return response.data[0]


@router.post("/assignments/{assignment_id}/regrade")
def regrade_assignment(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    submissions = (
        db.table("submissions")
        .select("id,status")
        .eq("assignment_id", assignment_id)
        .in_("status", ["uploaded", "completed", "review_required", "failed"])
        .execute()
        .data
    )
    workflow = GradingWorkflow(db)
    regraded = 0
    failed = 0
    for submission in submissions:
        try:
            workflow.run(submission["id"])
            regraded += 1
        except Exception:
            failed += 1
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.regraded",
        details={"regraded": regraded, "failed": failed},
    )
    return {"regraded": regraded, "failed": failed}


@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    submissions = (
        db.table("submissions")
        .select("*,students(name)")
        .eq("assignment_id", assignment_id)
        .order("created_at", desc=True)
        .execute()
    )
    return submissions.data


@router.post("/assignments/{assignment_id}/submissions", status_code=status.HTTP_201_CREATED)
async def upload_submission(
    assignment_id: str,
    file: UploadFile = File(...),
    student_id: str | None = Form(default=None),
    student_name: str | None = Form(default=None),
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    assignment = owned_assignment(db, assignment_id, user["id"])
    if student_id:
        student = db.table("students").select("id").eq("id", student_id).eq("class_id", assignment["class_id"]).limit(1).execute()
        if not student.data:
            raise HTTPException(status_code=400, detail="Student does not belong to this class")
    elif student_name and student_name.strip():
        student = (
            db.table("students")
            .insert({"class_id": assignment["class_id"], "name": student_name.strip()})
            .execute()
        )
        student_id = student.data[0]["id"]
    storage = SubmissionStorage(db)
    path = await storage.upload(user["id"], assignment_id, file)
    response = db.table("submissions").insert(
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "original_filename": file.filename or "submission",
            "storage_path": path,
            "mime_type": file.content_type,
            "max_score": assignment["total_points"],
        }
    ).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="submission",
        entity_id=response.data[0]["id"],
        action="submission.uploaded",
        details={"assignment_id": assignment_id, "filename": file.filename or "submission"},
    )
    return response.data[0]


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_assignment(db, assignment_id, user["id"])
    submissions = db.table("submissions").select("storage_path").eq("assignment_id", assignment_id).execute().data
    SubmissionStorage(db).delete_many([row["storage_path"] for row in submissions])
    db.table("assignments").delete().eq("id", assignment_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="assignment",
        entity_id=assignment_id,
        action="assignment.deleted",
        details={},
    )
