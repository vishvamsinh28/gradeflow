"""
Grading for the classroom domain.

Two calls to the model: read whose sheet each page belongs to when a whole class
arrives as one PDF, and mark one student's paper against the questions on it.
There is no answer key and no rubric — the teacher's guidance is a sentence.
"""

from __future__ import annotations

import json
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, model_validator

from app.core.config import get_settings


class QuestionMark(BaseModel):
    number: str
    awarded: float = Field(default=0, ge=0)
    out_of: float = Field(default=0, ge=0)
    note: str = ""

    @model_validator(mode="after")
    def cap_award(self) -> QuestionMark:
        self.awarded = min(self.awarded, self.out_of)
        return self


class SheetGrade(BaseModel):
    questions: list[QuestionMark] = Field(default_factory=list)
    score: float = Field(default=0, ge=0)
    out_of: float = Field(default=0, ge=0)
    summary: str = ""
    needs_review: bool = False
    review_reason: str | None = None


class SheetGrader:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = genai.Client(api_key=self.settings.gemini_api_key)
        self.model = self.settings.gemini_model

    def _json(self, parts: list[Any]) -> dict[str, Any]:
        response = self.client.models.generate_content(
            model=self.model,
            contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        if not response.text:
            raise RuntimeError("The model returned an empty response")
        try:
            return json.loads(response.text)
        except json.JSONDecodeError as exc:
            raise RuntimeError("The model returned invalid JSON") from exc

    def identify_pages(self, content: bytes, mime_type: str, page_count: int) -> list[str | None]:
        """Read the student name off each page of a scanned batch."""
        prompt = f"""
This PDF is a stack of {page_count} scanned answer sheets from one class, in order.
For every page, report the student's name if it is written on that page.

Return JSON: {{"pages": [{{"page": 1, "student_name": string|null}}, ...]}}

Rules:
- One entry per page, pages numbered from 1 to {page_count}.
- Use null when no name is written on that page. Continuation pages of a
  multi-page answer booklet usually have no name, and null is the correct
  answer for them — do not guess or carry a name forward.
- Copy the name exactly as written. Do not correct spelling.
""".strip()
        data = self._json(
            [
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type),
            ]
        )
        by_page: dict[int, str | None] = {}
        for entry in data.get("pages") or []:
            try:
                page = int(entry.get("page"))
            except (TypeError, ValueError):
                continue
            name = entry.get("student_name")
            by_page[page] = name.strip() if isinstance(name, str) and name.strip() else None
        return [by_page.get(page) for page in range(1, page_count + 1)]

    def read_roster(self, content: bytes, mime_type: str) -> list[dict[str, str | None]]:
        """Pull a student list off a photographed or scanned class register."""
        prompt = """
This image or PDF is a class register — a list of students in one classroom.
Read every student on it.

Return JSON: {"students": [{"name": string, "roll_no": string|null}, ...]}

Rules:
- One entry per student, in the order they appear.
- Copy names exactly as written. Do not correct spelling or reorder
  first and last names.
- roll_no is the roll number, admission number, or serial number beside the
  name. Use null when the sheet has none.
- Skip headers, totals, signatures, and anything that is not a student.
""".strip()
        data = self._json(
            [
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type),
            ]
        )
        students: list[dict[str, str | None]] = []
        for entry in data.get("students") or []:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            roll = entry.get("roll_no")
            students.append(
                {
                    "name": name.strip(),
                    "roll_no": str(roll).strip() if roll not in (None, "") else None,
                }
            )
        return students

    def grade(
        self,
        content: bytes,
        mime_type: str,
        max_marks: float,
        instructions: str | None,
        correction: str | None = None,
    ) -> SheetGrade:
        guidance = (instructions or "").strip()
        if correction:
            # A correction is the teacher overruling the previous pass, so it
            # goes last and is marked as taking precedence.
            guidance = f"{guidance}\n\nCorrection from the teacher, which overrides the above:\n{correction.strip()}".strip()

        guidance_block = (
            f"Teacher's guidance:\n{guidance}"
            if guidance
            else "No extra guidance was given. Mark fairly, awarding method marks "
            "where the approach is sound."
        )

        prompt = f"""
You are marking one student's answer sheet. The questions are on the sheet
itself — read them, read the student's work, and award marks.

The paper is out of {max_marks} marks in total.

{guidance_block}

Return JSON with exactly this shape:
{{
  "questions": [
    {{"number": string, "awarded": number, "out_of": number, "note": string}}
  ],
  "score": number,
  "out_of": number,
  "summary": string,
  "needs_review": boolean,
  "review_reason": string|null
}}

Rules:
- The sum of `awarded` must equal `score`, and the sum of `out_of` must equal {max_marks}.
- Never award more than `out_of` for a question.
- `note` is one short sentence a teacher could read at a glance.
- Set `needs_review` to true when handwriting is unreadable, a page looks
  missing, or you are genuinely unsure — being unsure is not the same as being
  wrong, and a flagged paper is better than a confident mistake.
""".strip()

        data = self._json(
            [
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type),
            ]
        )
        return SheetGrade.model_validate(normalize(data, max_marks))


def normalize(data: dict[str, Any], max_marks: float) -> dict[str, Any]:
    """Rescale to the paper's total so the model cannot invent a different one."""
    questions = []
    for raw in data.get("questions") or []:
        out_of = max(0.0, float(raw.get("out_of") or 0))
        awarded = max(0.0, float(raw.get("awarded") or 0))
        questions.append(
            {
                "number": str(raw.get("number") or "?"),
                "out_of": out_of,
                "awarded": min(awarded, out_of),
                "note": str(raw.get("note") or ""),
            }
        )

    total_out_of = sum(question["out_of"] for question in questions)
    if questions and total_out_of > 0 and abs(total_out_of - max_marks) > 0.01:
        scale = max_marks / total_out_of
        for question in questions:
            question["out_of"] = round(question["out_of"] * scale, 2)
            question["awarded"] = round(min(question["awarded"] * scale, question["out_of"]), 2)

    score = (
        sum(question["awarded"] for question in questions)
        if questions
        else max(0.0, min(float(data.get("score") or 0), max_marks))
    )
    return {
        **data,
        "questions": questions,
        "score": round(score, 2),
        "out_of": max_marks,
    }
