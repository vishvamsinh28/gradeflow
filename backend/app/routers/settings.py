from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user
from app.models.schemas import TeacherSettingsUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "gemini_model": "gemini-3.1-flash-lite",
    "confidence_threshold": 0.72,
    "default_subject": "Mathematics",
    "default_grade_level": None,
    "default_grading_rules": "Award method marks for a correct approach.\nDo not penalize the same arithmetic slip twice.",
}


def get_or_create_settings(db: Client, user_id: str) -> dict:
    response = db.table("teacher_settings").select("*").eq("user_id", user_id).limit(1).execute()
    if response.data:
        return response.data[0]
    created = db.table("teacher_settings").insert({"user_id": user_id, **DEFAULT_SETTINGS}).execute()
    return created.data[0]


@router.get("")
def get_settings(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    return get_or_create_settings(db, user["id"])


@router.patch("")
def update_settings(
    payload: TeacherSettingsUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    get_or_create_settings(db, user["id"])
    update = {
        **payload.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    response = db.table("teacher_settings").update(update).eq("user_id", user["id"]).execute()
    log_audit(
        db,
        owner_id=user["id"],
        actor_id=user["id"],
        entity_type="settings",
        entity_id=user["id"],
        action="settings.updated",
        details=payload.model_dump(),
    )
    return response.data[0]


@router.get("/audit-logs")
def list_audit_logs(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    return (
        db.table("audit_logs")
        .select("*")
        .eq("owner_id", user["id"])
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
    )
