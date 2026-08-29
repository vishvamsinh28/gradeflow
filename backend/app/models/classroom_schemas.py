"""Request models for the classroom domain."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GradeBand(APIModel):
    label: str = Field(min_length=1, max_length=12)
    min: float = Field(ge=0, le=100)


class ClassroomCreate(APIModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    subjects: list[str] = Field(default_factory=list, max_length=40)


class ClassroomUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    grade_scale: list[GradeBand] | None = None

    @field_validator("grade_scale")
    @classmethod
    def bands_must_descend(cls, value: list[GradeBand] | None) -> list[GradeBand] | None:
        if not value:
            return value
        thresholds = [band.min for band in value]
        if thresholds != sorted(thresholds, reverse=True):
            raise ValueError("Grade bands must be ordered from the highest threshold down")
        if len(set(thresholds)) != len(thresholds):
            raise ValueError("Grade bands cannot share a threshold")
        return value


class SubjectCreate(APIModel):
    name: str = Field(min_length=1, max_length=80)


class StudentInput(APIModel):
    name: str = Field(min_length=1, max_length=120)
    roll_no: str | None = Field(default=None, max_length=40)


class StudentsCreate(APIModel):
    students: list[StudentInput] = Field(min_length=1, max_length=300)


class StudentUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    roll_no: str | None = Field(default=None, max_length=40)


class TestCreate(APIModel):
    test_date: date
    title: str | None = Field(default=None, max_length=160)
    subject_id: str | None = None
    instructions: str | None = Field(default=None, max_length=2000)
    max_marks: float = Field(default=100, gt=0, le=10000)


class TestUpdate(APIModel):
    test_date: date | None = None
    title: str | None = Field(default=None, max_length=160)
    subject_id: str | None = None
    instructions: str | None = Field(default=None, max_length=2000)
    max_marks: float | None = Field(default=None, gt=0, le=10000)


class AttendanceEntry(APIModel):
    student_id: str
    mark: str = Field(pattern="^(present|absent)$")


class AttendanceUpdate(APIModel):
    entries: list[AttendanceEntry] = Field(min_length=1, max_length=300)


class SubmissionReview(APIModel):
    """A teacher correcting one mark, or accepting the one the model gave."""

    score: float | None = Field(default=None, ge=0)
    accept: bool = False


class RegradeRequest(APIModel):
    """Re-run a whole test with an extra correction appended to the guidance."""

    correction: str = Field(min_length=1, max_length=1000)
    only_flagged: bool = False
