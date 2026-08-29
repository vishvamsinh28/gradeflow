import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-value-long-enough-32")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routers.classroom import SUBMISSION_PRIVATE, submission_payload  # noqa: E402
from app.services.grader import normalize  # noqa: E402

client = TestClient(app)


def test_malformed_share_token_is_a_missing_link_not_a_server_error():
    # share_token is a uuid column. A truncated or mistyped link used to reach
    # Postgres, fail the cast, and surface to a parent as a 500.
    response = client.get("/api/v1/share/not-a-uuid")
    assert response.status_code == 404
    assert response.json()["detail"] == "This results link is not valid"


def test_submission_payload_withholds_the_storage_path():
    row = {
        "id": "sub-1",
        "test_id": "test-1",
        "student_id": "student-1",
        "score": 42,
        "storage_path": "answer-sheets/owner/test/student.pdf",
    }
    payload = submission_payload(row)
    assert "storage_path" not in payload
    assert payload["score"] == 42
    # The whitelist is the contract; if a private field is added it belongs here.
    assert set(SUBMISSION_PRIVATE) == {"storage_path"}


def test_question_marks_are_rescaled_to_the_paper_total():
    # The model grades question by question, and those sub-totals rarely add up
    # to the marks actually printed on the paper.
    graded = normalize(
        {"questions": [
            {"number": "1", "out_of": 10, "awarded": 8},
            {"number": "2", "out_of": 10, "awarded": 5},
        ]},
        max_marks=50,
    )
    assert graded["out_of"] == 50
    assert [q["out_of"] for q in graded["questions"]] == [25, 25]
    assert graded["score"] == 32.5


def test_awarded_marks_can_never_exceed_the_question_total():
    graded = normalize(
        {"questions": [{"number": "1", "out_of": 10, "awarded": 40}]}, max_marks=10
    )
    assert graded["score"] == 10


def test_a_paper_with_no_question_breakdown_is_clamped_to_the_total():
    graded = normalize({"score": 900}, max_marks=50)
    assert graded["out_of"] == 50
    assert graded["score"] == 50


def test_a_blank_paper_does_not_divide_by_zero():
    graded = normalize({"questions": [{"number": "1", "out_of": 0, "awarded": 0}]}, max_marks=50)
    assert graded["out_of"] == 50
    assert graded["score"] == 0


def test_retired_assignment_routes_are_gone():
    for path in (
        "/api/v1/classes",
        "/api/v1/assignments/any-id",
        "/api/v1/submissions/review-queue",
        "/api/v1/settings",
        "/api/v1/public/results/any-token",
    ):
        assert client.get(path).status_code == 404, path
