"""
Returning marks to a student or parent.

Unauthenticated and reached by an unguessable per-student token, so every field
here is whitelisted deliberately. Nothing internal — no model confidence, no
teacher notes, no other student's work — crosses this boundary.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.db.supabase import get_supabase
from app.routers.classroom import grade_for

router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{share_token}")
def student_results(share_token: str, db: Client = Depends(get_supabase)):
    # share_token is a uuid column: a truncated or mistyped link would otherwise
    # reach Postgres, fail the cast, and surface to a parent as a 500. A bad
    # token is a bad link, which is a 404.
    try:
        UUID(share_token)
    except ValueError:
        raise HTTPException(status_code=404, detail="This results link is not valid") from None

    found = (
        db.table("classroom_students")
        .select("id,name,code,classroom_id")
        .eq("share_token", share_token)
        .limit(1)
        .execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="This results link is not valid")
    student = found.data[0]

    classroom = (
        db.table("classrooms").select("name,grade_scale").eq("id", student["classroom_id"]).limit(1).execute().data
    )
    classroom = classroom[0] if classroom else {"name": "", "grade_scale": []}
    scale = classroom.get("grade_scale") or []

    tests = (
        db.table("tests")
        .select("id,title,test_date,max_marks,subject_id,status")
        .eq("classroom_id", student["classroom_id"])
        .order("test_date", desc=True)
        .execute()
        .data
    )
    # Only fully graded tests are shared. A test still collecting or mid-grading
    # would show a provisional mark as if it were final.
    releasable = {test["id"]: test for test in tests if test["status"] == "graded"}
    if not releasable:
        return {"student": {"name": student["name"]}, "classroom": {"name": classroom["name"]}, "results": []}

    subjects = {
        row["id"]: row["name"]
        for row in db.table("subjects").select("id,name").eq("classroom_id", student["classroom_id"]).execute().data
    }
    submissions = (
        db.table("test_submissions")
        .select("test_id,score,out_of,summary,questions,status")
        .eq("student_id", student["id"])
        .eq("status", "graded")
        .in_("test_id", list(releasable))
        .execute()
        .data
    )
    absent = {
        row["test_id"]
        for row in db.table("test_attendance").select("test_id,mark").eq("student_id", student["id"]).execute().data
        if row["mark"] == "absent"
    }

    results = []
    for submission in submissions:
        test = releasable[submission["test_id"]]
        out_of = float(submission["out_of"] or test["max_marks"] or 0)
        percent = round(float(submission["score"] or 0) / out_of * 100, 1) if out_of else None
        results.append(
            {
                "title": test.get("title") or "Test",
                "subject": subjects.get(test.get("subject_id")),
                "date": test["test_date"],
                "score": submission["score"],
                "out_of": submission["out_of"],
                "percent": percent,
                "grade": grade_for(percent, scale),
                "summary": submission.get("summary"),
                "questions": [
                    {
                        "number": question.get("number"),
                        "awarded": question.get("awarded"),
                        "out_of": question.get("out_of"),
                        "note": question.get("note"),
                    }
                    for question in (submission.get("questions") or [])
                ],
            }
        )

    return {
        "student": {"name": student["name"], "code": student["code"]},
        "classroom": {"name": classroom["name"]},
        "missed": [
            {"title": releasable[test_id].get("title") or "Test", "date": releasable[test_id]["test_date"]}
            for test_id in absent
            if test_id in releasable
        ],
        "results": results,
    }
