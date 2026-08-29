from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.db.supabase import get_supabase

router = APIRouter(prefix="/public", tags=["public"])


def public_student_payload(student: dict) -> dict:
    return {"name": student["name"]}


def public_submission_payload(submission: dict, assignment: dict | None) -> dict:
    """
    Whitelist, never spread. The stored `feedback` blob also holds
    `teacher_action` (an instruction written for the teacher) and `teacher_note`
    (their private note from review); `confidence` and `status` are internal
    signals. None of that belongs on an unauthenticated link.
    """
    feedback = submission.get("feedback") or {}
    return {
        "id": submission["id"],
        "assignment": assignment,
        "score": submission.get("score"),
        "max_score": submission.get("max_score"),
        "summary": feedback.get("summary"),
        "reviewed_at": submission.get("reviewed_at"),
        "created_at": submission.get("created_at"),
    }


def public_classroom_payload(student: dict) -> dict | None:
    classroom = student.get("classes")
    if not classroom:
        return None
    return {
        "name": classroom["name"],
        "subject": classroom["subject"],
        "grade_level": classroom.get("grade_level"),
    }


@router.get("/results/{portal_token}")
def returned_results(portal_token: str, db: Client = Depends(get_supabase)):
    student_response = (
        db.table("students")
        .select("id,name,class_id,classes(name,subject,grade_level)")
        .eq("portal_token", portal_token)
        .limit(1)
        .execute()
    )
    if not student_response.data:
        raise HTTPException(status_code=404, detail="Results link not found")
    student = student_response.data[0]
    public_student = public_student_payload(student)
    public_classroom = public_classroom_payload(student)
    assignments = (
        db.table("assignments")
        .select("id,title,total_points,status,created_at")
        .eq("class_id", student["class_id"])
        .eq("status", "returned")
        .execute()
        .data
    )
    if not assignments:
        return {"student": public_student, "classroom": public_classroom, "submissions": []}
    assignment_by_id = {assignment["id"]: assignment for assignment in assignments}
    submissions = (
        db.table("submissions")
        .select("id,assignment_id,status,score,max_score,feedback,confidence,reviewed_at,created_at")
        .eq("student_id", student["id"])
        .in_("assignment_id", list(assignment_by_id))
        # A returned assignment can still contain work that is mid-grading,
        # failed, or flagged for a review the teacher has not done yet.
        .eq("status", "completed")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {
        "student": public_student,
        "classroom": public_classroom,
        "submissions": [
            public_submission_payload(
                submission, assignment_by_id.get(submission["assignment_id"])
            )
            for submission in submissions
        ],
    }
