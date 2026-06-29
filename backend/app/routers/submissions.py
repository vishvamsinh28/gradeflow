from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_assignment, owned_submission
from app.models.schemas import ReviewUpdate
from app.services.audit import log_audit
from app.services.storage import SubmissionStorage
from app.workflows.grading import GradingWorkflow

router = APIRouter(prefix="/submissions", tags=["submissions"])
logger = logging.getLogger(__name__)


@router.get("/review-queue")
def review_queue(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    classes = db.table("classes").select("id,name").eq("owner_id", user["id"]).execute().data
    if not classes:
        return []
    class_by_id = {row["id"]: row for row in classes}
    assignments = db.table("assignments").select("id,title,class_id").in_("class_id", list(class_by_id)).execute().data
    if not assignments:
        return []
    assignment_by_id = {row["id"]: row for row in assignments}
    submissions = (
        db.table("submissions")
        .select("id,assignment_id,student_id,original_filename,status,score,max_score,confidence,review_required,students(name)")
        .in_("assignment_id", list(assignment_by_id))
        .eq("review_required", True)
        .order("updated_at", desc=True)
        .execute()
        .data
    )
    return [
        {
            **submission,
            "assignment": assignment_by_id[submission["assignment_id"]],
            "classroom": class_by_id[assignment_by_id[submission["assignment_id"]]["class_id"]],
        }
        for submission in submissions
    ]


@router.get("/{submission_id}")
def get_submission(
    submission_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    submission = owned_submission(db, submission_id, user["id"])
    grades = (
        db.table("grading_results")
        .select("*")
        .eq("submission_id", submission_id)
        .order("question_number")
        .execute()
        .data
    )
    student = None
    if submission.get("student_id"):
        result = db.table("students").select("id,name,external_id").eq("id", submission["student_id"]).limit(1).execute()
        student = result.data[0] if result.data else None
    assignment = db.table("assignments").select("id,title,class_id").eq("id", submission["assignment_id"]).limit(1).execute()
    return {
        **submission,
        "student": student,
        "assignment": assignment.data[0] if assignment.data else None,
        "question_results": grades,
    }


@router.get("/{submission_id}/file")
def get_submission_file(
    submission_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    submission = owned_submission(db, submission_id, user["id"])
    content = SubmissionStorage(db).download(submission["storage_path"])
    return Response(content=content, media_type=submission["mime_type"])


@router.post("/{submission_id}/grade")
def grade_submission(
    submission_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_submission(db, submission_id, user["id"])
    try:
        GradingWorkflow(db).run(submission_id)
    except Exception as exc:
        logger.exception("Grading failed for submission %s", submission_id)
        raise HTTPException(status_code=502, detail="Grading failed. Please retry or review the submission manually.") from exc
    submission = owned_submission(db, submission_id, user["id"])
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="submission",
        entity_id=submission_id,
        action="submission.graded",
        details={"assignment_id": submission["assignment_id"], "status": submission["status"]},
    )
    return {"id": submission_id, "status": submission["status"]}


@router.post("/{submission_id}/approve")
def approve_submission(
    submission_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_submission(db, submission_id, user["id"])
    now = datetime.now(timezone.utc).isoformat()
    response = db.table("submissions").update(
        {
            "status": "completed",
            "review_required": False,
            "reviewed_at": now,
            "updated_at": now,
        }
    ).eq("id", submission_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="submission",
        entity_id=submission_id,
        action="submission.approved",
        details={"assignment_id": response.data[0]["assignment_id"], "score": response.data[0].get("score")},
    )
    return response.data[0]


@router.patch("/{submission_id}/review")
def review_submission(
    submission_id: str,
    payload: ReviewUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    submission = owned_submission(db, submission_id, user["id"])
    assignment = owned_assignment(db, submission["assignment_id"], user["id"])
    if payload.score > float(assignment["total_points"]):
        raise HTTPException(status_code=400, detail="Score exceeds assignment total")
    feedback = submission.get("feedback") or {}
    if payload.teacher_note:
        feedback["teacher_note"] = payload.teacher_note
    response = db.table("submissions").update(
        {
            "score": payload.score,
            "feedback": feedback,
            "status": "completed",
            "review_required": False,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", submission_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="submission",
        entity_id=submission_id,
        action="submission.reviewed",
        details={"assignment_id": submission["assignment_id"], "score": payload.score, "teacher_note": bool(payload.teacher_note)},
    )
    return response.data[0]


@router.delete("/{submission_id}", status_code=204)
def delete_submission(
    submission_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    submission = owned_submission(db, submission_id, user["id"])
    SubmissionStorage(db).delete_many([submission["storage_path"]])
    db.table("grading_results").delete().eq("submission_id", submission_id).execute()
    db.table("submissions").delete().eq("id", submission_id).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="submission",
        entity_id=submission_id,
        action="submission.deleted",
        details={"assignment_id": submission["assignment_id"]},
    )
