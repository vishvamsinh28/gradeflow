from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(APIModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(APIModel):
    email: EmailStr
    password: str


class UserResponse(APIModel):
    id: UUID
    email: EmailStr
    full_name: str
    created_at: datetime


class AuthResponse(APIModel):
    user: UserResponse
    access_token: str


class ClassCreate(APIModel):
    name: str = Field(min_length=2, max_length=120)
    subject: str = Field(default="Mathematics", min_length=2, max_length=80)
    grade_level: str | None = Field(default=None, max_length=40)


class StudentCreate(APIModel):
    name: str = Field(min_length=2, max_length=120)
    external_id: str | None = Field(default=None, max_length=80)


class TeacherSettingsUpdate(APIModel):
    gemini_model: str = Field(min_length=2, max_length=120)
    confidence_threshold: float = Field(ge=0, le=1)
    default_subject: str = Field(min_length=2, max_length=80)
    default_grade_level: str | None = Field(default=None, max_length=40)
    default_grading_rules: str = Field(min_length=2, max_length=2000)


class AssignmentCreate(APIModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    total_points: float = Field(gt=0, le=10000)
    answer_key: dict[str, Any]
    rubric: dict[str, Any]
    status: str = Field(default="draft", pattern="^(draft|active|archived|returned)$")


class AssignmentStatusUpdate(APIModel):
    status: str = Field(pattern="^(draft|active|archived|returned)$")


class AssignmentUpdate(APIModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    total_points: float = Field(gt=0, le=10000)
    answer_key: dict[str, Any]
    rubric: dict[str, Any]
    change_note: str | None = Field(default=None, max_length=500)


class ReviewUpdate(APIModel):
    score: float = Field(ge=0)
    teacher_note: str | None = Field(default=None, max_length=2000)


class QuestionGrade(APIModel):
    question_number: str
    student_work: str = ""
    score: float = Field(default=0, ge=0)
    max_score: float = Field(default=0, ge=0)
    is_correct: bool = False
    feedback: str = ""
    confidence: float = Field(default=0, ge=0, le=1)
    error_category: str | None = None

    @model_validator(mode="after")
    def score_must_fit_maximum(self) -> "QuestionGrade":
        if self.score > self.max_score:
            raise ValueError("Question score cannot exceed question maximum")
        return self


class ExtractionResult(APIModel):
    student_name: str | None = None
    questions: list[dict[str, Any]] = Field(default_factory=list)
    document_notes: str = ""


class GradingResult(APIModel):
    questions: list[QuestionGrade] = Field(default_factory=list)
    score: float = Field(default=0, ge=0)
    max_score: float = Field(default=0, ge=0)
    overall_feedback: str = ""
    confidence: float = Field(default=0, ge=0, le=1)

    @model_validator(mode="after")
    def totals_must_match_questions(self) -> "GradingResult":
        if self.score > self.max_score:
            raise ValueError("Total score cannot exceed total maximum")
        if self.questions:
            question_score = sum(question.score for question in self.questions)
            question_max = sum(question.max_score for question in self.questions)
            if abs(question_score - self.score) > 0.01:
                raise ValueError("Question scores must add up to total score")
            if abs(question_max - self.max_score) > 0.01:
                raise ValueError("Question maxima must add up to total maximum")
        return self
