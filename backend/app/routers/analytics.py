from collections import Counter

from fastapi import APIRouter, Depends
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user, owned_assignment

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/assignments/{assignment_id}")
def assignment_analytics(
    assignment_id: str,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    assignment = owned_assignment(db, assignment_id, user["id"])
    submissions = db.table("submissions").select("id,status,score,max_score,confidence,review_required").eq("assignment_id", assignment_id).execute().data
    scored = [row for row in submissions if row.get("score") is not None]
    average = round(sum(float(row["score"]) for row in scored) / len(scored), 2) if scored else 0
    percentages = [
        (float(row["score"]) / float(row["max_score"]) * 100)
        for row in scored
        if row.get("max_score")
    ]
    grade_rows = []
    if submissions:
        ids = [row["id"] for row in submissions]
        grade_rows = db.table("grading_results").select("error_category").in_("submission_id", ids).execute().data
    errors = Counter(row["error_category"] for row in grade_rows if row.get("error_category"))
    return {
        "assignment_id": assignment_id,
        "assignment_title": assignment["title"],
        "submission_count": len(submissions),
        "scored_count": len(scored),
        "review_required_count": sum(bool(row["review_required"]) for row in submissions),
        "average_score": average,
        "average_percentage": round(sum(percentages) / len(percentages), 1) if percentages else 0,
        "common_errors": [{"category": name, "count": count} for name, count in errors.most_common(5)],
    }
