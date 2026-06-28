from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_assignment, owned_submission
from app.models.schemas import ReviewUpdate
from app.workflows.grading import GradingWorkflow

router = APIRouter(prefix="/submissions", tags=["submissions"])


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
    return {**submission, "student": student, "question_results": grades}


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
        raise HTTPException(status_code=502, detail=f"Grading failed: {exc}") from exc
    submission = owned_submission(db, submission_id, user["id"])
    return {"id": submission_id, "status": submission["status"]}


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
    return response.data[0]
