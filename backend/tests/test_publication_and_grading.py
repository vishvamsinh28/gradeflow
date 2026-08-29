import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-key")
os.environ.setdefault("JWT_SECRET", "a-test-secret-that-is-long-enough")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from app.models.schemas import GradingResult
from app.routers.assignments import return_blocking_submissions
from app.routers.public import public_classroom_payload, public_student_payload
from app.routers.submissions import approved_ai_totals
from app.services.gemini import normalize_grading_payload


def test_return_results_blocks_incomplete_or_review_required_submissions():
    blockers = return_blocking_submissions(
        [
            {"id": "completed", "status": "completed", "review_required": False, "score": 8, "max_score": 10},
            {"id": "failed", "status": "failed", "review_required": False},
            {"id": "review", "status": "completed", "review_required": True},
            {"id": "unscored", "status": "completed", "review_required": False, "score": None, "max_score": 10},
        ]
    )

    assert [submission["id"] for submission in blockers] == ["failed", "review", "unscored"]


def test_public_student_payload_omits_private_identifiers():
    student = {
        "id": "student-id",
        "name": "Asha Rao",
        "external_id": "school-private-id",
        "portal_token": "private-token",
        "class_id": "class-id",
        "classes": {"id": "class-id", "name": "Algebra", "subject": "Math", "grade_level": "8"},
    }

    assert public_student_payload(student) == {"name": "Asha Rao"}
    assert public_classroom_payload(student) == {
        "name": "Algebra",
        "subject": "Math",
        "grade_level": "8",
    }


def test_approval_requires_existing_grade_rows_with_maximum():
    assert approved_ai_totals([{"score": 4, "max_score": 5}, {"score": 3, "max_score": 5}]) == (7, 10)

    try:
        approved_ai_totals([])
    except Exception as error:
        assert getattr(error, "status_code", None) == 400
        assert getattr(error, "detail", "") == "Grade the submission before approving it"
    else:
        raise AssertionError("Expected approval without grade rows to fail")

    try:
        approved_ai_totals([{"score": 0, "max_score": 0}])
    except Exception as error:
        assert getattr(error, "status_code", None) == 400
        assert getattr(error, "detail", "") == "Cannot approve a submission without a score maximum"
    else:
        raise AssertionError("Expected approval without score maximum to fail")


def test_grading_payload_normalization_scales_question_rows_to_assignment_total():
    normalized = normalize_grading_payload(
        {
            "questions": [
                {
                    "question_number": "1",
                    "student_work": "work",
                    "score": 6,
                    "max_score": 6,
                    "is_correct": True,
                    "feedback": "Good.",
                    "confidence": 0.9,
                    "error_category": None,
                },
                {
                    "question_number": "2",
                    "student_work": "work",
                    "score": 3,
                    "max_score": 6,
                    "is_correct": False,
                    "feedback": "Partial.",
                    "confidence": 0.8,
                    "error_category": "arithmetic",
                },
            ],
            "score": 9,
            "max_score": 12,
            "overall_feedback": "Solid.",
            "confidence": 0.85,
        },
        total_points=10,
    )

    result = GradingResult.model_validate(normalized)

    assert result.max_score == 10
    assert result.score == 7.5
    assert sum(question.max_score for question in result.questions) == result.max_score
    assert sum(question.score for question in result.questions) == result.score
