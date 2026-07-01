import json
from typing import Any

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.gemini_models import resolve_gemini_model
from app.models.schemas import ExtractionResult, GradingResult


def normalize_grading_payload(data: dict[str, Any], total_points: float) -> dict[str, Any]:
    total_points = max(0, float(total_points))
    questions = data.get("questions") or []
    normalized_questions: list[dict[str, Any]] = []

    for question in questions:
        normalized = dict(question)
        max_score = max(0, float(normalized.get("max_score") or 0))
        score = max(0, float(normalized.get("score") or 0))
        normalized["max_score"] = max_score
        normalized["score"] = min(score, max_score)
        normalized_questions.append(normalized)

    if normalized_questions:
        question_max = sum(question["max_score"] for question in normalized_questions)
        if question_max > 0:
            scale = total_points / question_max
            for question in normalized_questions:
                question["max_score"] *= scale
                question["score"] = min(question["score"] * scale, question["max_score"])
        elif total_points > 0:
            per_question_max = total_points / len(normalized_questions)
            for question in normalized_questions:
                question["max_score"] = per_question_max
                question["score"] = 0

        return {
            **data,
            "questions": normalized_questions,
            "score": sum(question["score"] for question in normalized_questions),
            "max_score": sum(question["max_score"] for question in normalized_questions),
        }

    return {
        **data,
        "score": max(0, min(float(data.get("score") or 0), total_points)),
        "max_score": total_points,
    }


class GeminiGrader:
    def __init__(self, model: str | None = None) -> None:
        self.settings = get_settings()
        self.model = resolve_gemini_model(model)
        self.client = genai.Client(api_key=self.settings.gemini_api_key)

    def _json_response(self, contents: list[Any]) -> dict[str, Any]:
        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned an empty response")
        try:
            return json.loads(response.text)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Gemini returned invalid JSON") from exc

    def extract_work(self, file_bytes: bytes, mime_type: str) -> ExtractionResult:
        prompt = """
You are reading a student's mathematics worksheet. Extract only what is visible.
Return JSON with this exact shape:
{
  "student_name": string|null,
  "questions": [
    {
      "number": string,
      "prompt": string,
      "student_work": string,
      "final_answer": string|null,
      "legibility_confidence": number between 0 and 1
    }
  ],
  "document_notes": string
}
Preserve mathematical symbols in plain text or LaTeX. Do not solve, grade, or invent missing work.
If a region is unreadable, explicitly mark it as unreadable and lower its confidence.
""".strip()
        data = self._json_response(
            [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    ],
                )
            ]
        )
        return ExtractionResult.model_validate(data)

    def grade_work(
        self,
        extracted: ExtractionResult,
        answer_key: dict[str, Any],
        rubric: dict[str, Any],
        total_points: float,
    ) -> GradingResult:
        prompt = f"""
You are a careful mathematics grading assistant. Grade the extracted student work against
only the supplied answer key and rubric. Give method/partial credit when the rubric supports it.
Never reward an unsupported answer. Treat unreadable work as uncertain rather than incorrect.
The assignment maximum is {total_points} points.

ANSWER KEY:
{json.dumps(answer_key, ensure_ascii=False)}

RUBRIC:
{json.dumps(rubric, ensure_ascii=False)}

EXTRACTED STUDENT WORK:
{extracted.model_dump_json()}

Return JSON with this exact shape:
{{
  "questions": [
    {{
      "question_number": string,
      "student_work": string,
      "score": number,
      "max_score": number,
      "is_correct": boolean,
      "feedback": string,
      "confidence": number between 0 and 1,
      "error_category": string|null
    }}
  ],
  "score": number,
  "max_score": number,
  "overall_feedback": string,
  "confidence": number between 0 and 1
}}

The sum of question scores must equal score. The sum of question maxima must equal max_score.
Keep feedback concise, specific, and suitable for a teacher to review.
""".strip()
        data = self._json_response(
            [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)],
                )
            ]
        )
        return GradingResult.model_validate(normalize_grading_payload(data, total_points))
