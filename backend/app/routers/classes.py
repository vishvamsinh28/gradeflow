from fastapi import APIRouter, Depends, status
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_class
from app.models.schemas import ClassCreate, StudentCreate

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("")
def list_classes(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    response = (
        db.table("classes")
        .select("*")
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
