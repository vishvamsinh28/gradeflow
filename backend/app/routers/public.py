from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.db.supabase import get_supabase

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/results/{portal_token}")
def returned_results(portal_token: str, db: Client = Depends(get_supabase)):
    student_response = (
        db.table("students")
        .select("id,name,external_id,portal_token,class_id,classes(id,name,subject,grade_level)")
        .eq("portal_token", portal_token)
        .limit(1)
        .execute()
    )
    if not student_response.data:
        raise HTTPException(status_code=404, detail="Results link not found")
    student = student_response.data[0]
    assignments = (
        db.table("assignments")
        .select("id,title,total_points,status,created_at")
        .eq("class_id", student["class_id"])
        .eq("status", "returned")
        .execute()
        .data
    )
    if not assignments:
        return {"student": student, "classroom": student.get("classes"), "submissions": []}
    assignment_by_id = {assignment["id"]: assignment for assignment in assignments}
    submissions = (
        db.table("submissions")
        .select("id,assignment_id,original_filename,status,score,max_score,feedback,confidence,reviewed_at,created_at")
        .eq("student_id", student["id"])
        .in_("assignment_id", list(assignment_by_id))
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {
        "student": student,
        "classroom": student.get("classes"),
        "submissions": [
            {**submission, "assignment": assignment_by_id.get(submission["assignment_id"])}
            for submission in submissions
        ],
    }
