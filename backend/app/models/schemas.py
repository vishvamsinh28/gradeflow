from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class ClassCreate(APIModel):
    name: str = Field(min_length=2, max_length=120)
    subject: str = Field(default="Mathematics", min_length=2, max_length=80)
    grade_level: str | None = Field(default=None, max_length=40)


class StudentCreate(APIModel):
    name: str = Field(min_length=2, max_length=120)
    external_id: str | None = Field(default=None, max_length=80)


class AssignmentCreate(APIModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    total_points: float = Field(gt=0, le=10000)
    answer_key: dict[str, Any]
    rubric: dict[str, Any]
    status: str = Field(default="active", pattern="^(draft|active|archived)$")


class ReviewUpdate(APIModel):
    score: float = Field(ge=0)
    teacher_note: str | None = Field(default=None, max_length=2000)


class QuestionGrade(APIModel):
    question_number: str
    student_work: str = ""
    score: float = 0
    max_score: float = 0
    is_correct: bool = False
    feedback: str = ""
    confidence: float = Field(default=0, ge=0, le=1)
    error_category: str | None = None


class ExtractionResult(APIModel):
    student_name: str | None = None
    questions: list[dict[str, Any]] = Field(default_factory=list)
    document_notes: str = ""


class GradingResult(APIModel):
    questions: list[QuestionGrade] = Field(default_factory=list)
    score: float = 0
    max_score: float = 0
    overall_feedback: str = ""
    confidence: float = Field(default=0, ge=0, le=1)
