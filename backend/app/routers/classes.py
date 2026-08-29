import logging

from fastapi import APIRouter, Depends, status
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_class
from app.models.schemas import ClassCreate, StudentCreate
from app.services.storage import SubmissionStorage

router = APIRouter(prefix="/classes", tags=["classes"])
logger = logging.getLogger(__name__)


@router.get("")
def list_classes(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    response = (
        db.table("classes")
        .select("*,students(id),assignments(id)")
        .eq("owner_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_class(payload: ClassCreate, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    response = db.table("classes").insert({"owner_id": user["id"], **payload.model_dump()}).execute()
    return response.data[0]


@router.get("/{class_id}")
def get_class(class_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    classroom = owned_class(db, class_id, user["id"])
    students = db.table("students").select("*").eq("class_id", class_id).order("name").execute().data
    assignments = (
        db.table("assignments")
        .select("*")
        .eq("class_id", class_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {**classroom, "students": students, "assignments": assignments}


@router.post("/{class_id}/students", status_code=status.HTTP_201_CREATED)
def add_student(
    class_id: str,
    payload: StudentCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_class(db, class_id, user["id"])
    response = db.table("students").insert({"class_id": class_id, **payload.model_dump()}).execute()
    return response.data[0]


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(class_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    owned_class(db, class_id, user["id"])
    assignments = db.table("assignments").select("id").eq("class_id", class_id).execute().data
    assignment_ids = [assignment["id"] for assignment in assignments]
    submissions: list[dict] = []
    if assignment_ids:
        submissions = (
            db.table("submissions")
            .select("storage_path")
            .in_("assignment_id", assignment_ids)
            .execute()
            .data
        )
    db.table("classes").delete().eq("id", class_id).execute()
    if assignment_ids:
        try:
            SubmissionStorage(db).delete_many([row["storage_path"] for row in submissions])
        except Exception:
            logger.exception("Storage cleanup failed for deleted class %s", class_id)


@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    class_id: str,
    student_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_class(db, class_id, user["id"])
    student = db.table("students").select("id").eq("id", student_id).eq("class_id", class_id).limit(1).execute()
    if not student.data:
        return
    db.table("students").delete().eq("id", student_id).execute()


@router.get("/{class_id}/students/{student_id}")
def get_student(
    class_id: str,
    student_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    classroom = owned_class(db, class_id, user["id"])
    student = db.table("students").select("*").eq("id", student_id).eq("class_id", class_id).limit(1).execute().data
    if not student:
        return {"student": None, "classroom": classroom, "submissions": []}
    assignments = db.table("assignments").select("id,title,total_points").eq("class_id", class_id).execute().data
    assignment_by_id = {assignment["id"]: assignment for assignment in assignments}
    submissions = (
        db.table("submissions")
        .select("id,assignment_id,original_filename,status,score,max_score,confidence,review_required,created_at")
        .eq("student_id", student_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {
        "student": student[0],
        "classroom": classroom,
        "submissions": [
            {**submission, "assignment": assignment_by_id.get(submission["assignment_id"])}
            for submission in submissions
        ],
    }
