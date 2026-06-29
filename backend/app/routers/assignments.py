from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_assignment, owned_class
from app.models.schemas import AssignmentCreate
from app.services.storage import SubmissionStorage

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
