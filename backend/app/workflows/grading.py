from datetime import datetime, timezone
from typing import Any, Literal

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy
from supabase import Client
from typing_extensions import TypedDict

from app.core.config import get_settings
from app.models.schemas import ExtractionResult, GradingResult
from app.services.gemini import GeminiGrader
from app.services.storage import SubmissionStorage


class GradingState(TypedDict, total=False):
    submission_id: str
    submission: dict[str, Any]
    assignment: dict[str, Any]
    extracted: dict[str, Any]
    grading: dict[str, Any]
    confidence: float
    review_required: bool
    final_feedback: dict[str, Any]
    status: str


class GradingWorkflow:
    def __init__(self, db: Client):
        self.db = db
        self.storage = SubmissionStorage(db)
        self.gemini = GeminiGrader()
        self.settings = get_settings()
        self.graph = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(GradingState)
        builder.add_node("load_context", self.load_context)
        builder.add_node(
            "extract_work",
            self.extract_work,
            retry_policy=RetryPolicy(max_attempts=2),
        )
        builder.add_node(
            "grade_work",
            self.grade_work,
            retry_policy=RetryPolicy(max_attempts=2),
        )
        builder.add_node("calculate_confidence", self.calculate_confidence)
        builder.add_node("mark_for_review", self.mark_for_review)
        builder.add_node("generate_summary", self.generate_summary)
        builder.add_node("persist_result", self.persist_result)

        builder.add_edge(START, "load_context")
        builder.add_edge("load_context", "extract_work")
        builder.add_edge("extract_work", "grade_work")
        builder.add_edge("grade_work", "calculate_confidence")
        builder.add_conditional_edges(
            "calculate_confidence",
            self.route_by_confidence,
            {
                "review": "mark_for_review",
                "complete": "generate_summary",
            },
        )
        builder.add_edge("mark_for_review", "persist_result")
        builder.add_edge("generate_summary", "persist_result")
        builder.add_edge("persist_result", END)
        return builder.compile()

    def load_context(self, state: GradingState) -> dict[str, Any]:
        submission_response = (
            self.db.table("submissions")
            .select("*")
            .eq("id", state["submission_id"])
            .limit(1)
            .execute()
        )
        if not submission_response.data:
            raise ValueError("Submission not found")
        submission = submission_response.data[0]
        assignment_response = (
            self.db.table("assignments")
            .select("*")
            .eq("id", submission["assignment_id"])
            .limit(1)
            .execute()
        )
        if not assignment_response.data:
            raise ValueError("Assignment not found")
        return {"submission": submission, "assignment": assignment_response.data[0]}

    def extract_work(self, state: GradingState) -> dict[str, Any]:
        submission = state["submission"]
        file_bytes = self.storage.download(submission["storage_path"])
        extracted = self.gemini.extract_work(file_bytes, submission["mime_type"])
        return {"extracted": extracted.model_dump()}

    def grade_work(self, state: GradingState) -> dict[str, Any]:
        assignment = state["assignment"]
        extracted = ExtractionResult.model_validate(state["extracted"])
        grading = self.gemini.grade_work(
            extracted=extracted,
            answer_key=assignment["answer_key"],
            rubric=assignment["rubric"],
            total_points=float(assignment["total_points"]),
        )
        return {"grading": grading.model_dump()}

    def calculate_confidence(self, state: GradingState) -> dict[str, Any]:
        grading = GradingResult.model_validate(state["grading"])
        question_confidences = [q.confidence for q in grading.questions]
        confidence = grading.confidence
        if question_confidences:
            confidence = min(confidence, sum(question_confidences) / len(question_confidences))
        confidence = round(max(0, min(confidence, 1)), 3)
        return {
            "confidence": confidence,
            "review_required": confidence < self.settings.grading_confidence_threshold,
        }

    def route_by_confidence(self, state: GradingState) -> Literal["review", "complete"]:
        return "review" if state["review_required"] else "complete"

    def mark_for_review(self, state: GradingState) -> dict[str, Any]:
        grading = GradingResult.model_validate(state["grading"])
        return {
            "status": "review_required",
            "final_feedback": {
                "summary": grading.overall_feedback,
                "teacher_action": "Review low-confidence extraction or grading before releasing.",
            },
        }

    def generate_summary(self, state: GradingState) -> dict[str, Any]:
        grading = GradingResult.model_validate(state["grading"])
        return {
            "status": "completed",
            "final_feedback": {
                "summary": grading.overall_feedback,
                "teacher_action": "Result is ready for optional teacher approval.",
            },
        }

    def persist_result(self, state: GradingState) -> dict[str, Any]:
        grading = GradingResult.model_validate(state["grading"])
        submission_id = state["submission_id"]

        self.db.table("grading_results").delete().eq("submission_id", submission_id).execute()
        rows = [
            {
                "submission_id": submission_id,
                **question.model_dump(),
            }
            for question in grading.questions
        ]
        if rows:
            self.db.table("grading_results").insert(rows).execute()

        self.db.table("submissions").update(
            {
                "status": state["status"],
                "extracted_answers": state["extracted"],
                "score": grading.score,
                "max_score": grading.max_score,
                "feedback": state["final_feedback"],
                "confidence": state["confidence"],
                "review_required": state["review_required"],
                "error_message": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", submission_id).execute()
        return {"status": state["status"]}

    def run(self, submission_id: str) -> GradingState:
        self.db.table("submissions").update(
            {"status": "processing", "error_message": None, "updated_at": "now()"}
        ).eq("id", submission_id).execute()
        try:
            return self.graph.invoke({"submission_id": submission_id})
        except Exception as exc:
            self.db.table("submissions").update(
                {
                    "status": "failed",
                    "error_message": str(exc)[:1000],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", submission_id).execute()
            raise
