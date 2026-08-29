"""
The classroom domain: classrooms, subjects, students, tests, answer sheets,
attendance and marks. Everything a teacher creates lives here, in Postgres.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from supabase import Client

from app.db.supabase import get_supabase
from app.dependencies import get_current_user
from app.models.classroom_schemas import (
    AttendanceUpdate,
    ClassroomCreate,
    ClassroomUpdate,
    RegradeRequest,
    StudentsCreate,
    StudentUpdate,
    SubjectCreate,
    SubmissionReview,
    TestCreate,
    TestUpdate,
)
from app.services.grader import SheetGrader
from app.services.sheets import (
    MAX_FILES,
    MAX_PDF_PAGES,
    SheetFile,
    SheetStorage,
    extract_pdf_pages,
    group_pages_by_student,
    match_name_to_student,
    pdf_page_count,
    read_upload,
)

router = APIRouter(tags=["classroom"])
logger = logging.getLogger(__name__)


# ---------- ownership ----------
#
# Every read and write funnels through one of these. A route that forgets to
# call one cannot reach a row, because nothing else resolves an id.


def owned_classroom(db: Client, classroom_id: str, user_id: str) -> dict[str, Any]:
    result = (
        db.table("classrooms").select("*").eq("id", classroom_id).eq("owner_id", user_id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return result.data[0]


def owned_classroom_by_slug(db: Client, slug: str, user_id: str) -> dict[str, Any]:
    result = db.table("classrooms").select("*").eq("slug", slug).eq("owner_id", user_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return result.data[0]


def owned_test(db: Client, test_id: str, user_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    result = db.table("tests").select("*").eq("id", test_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Test not found")
    test = result.data[0]
    return test, owned_classroom(db, test["classroom_id"], user_id)


def owned_submission(db: Client, submission_id: str, user_id: str) -> tuple[dict, dict, dict]:
    result = db.table("test_submissions").select("*").eq("id", submission_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission = result.data[0]
    test, classroom = owned_test(db, submission["test_id"], user_id)
    return submission, test, classroom


def owned_student(db: Client, student_id: str, user_id: str) -> tuple[dict, dict]:
    result = db.table("classroom_students").select("*").eq("id", student_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Student not found")
    student = result.data[0]
    return student, owned_classroom(db, student["classroom_id"], user_id)


# ---------- helpers ----------


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:48] or "classroom"


def unique_slug(db: Client, owner_id: str, name: str) -> str:
    base = slugify(name)
    taken = {
        row["slug"]
        for row in db.table("classrooms").select("slug").eq("owner_id", owner_id).execute().data
    }
    if base not in taken:
        return base
    suffix = 2
    while f"{base}-{suffix}" in taken:
        suffix += 1
    return f"{base}-{suffix}"


def next_student_codes(existing: list[dict], count: int) -> list[str]:
    highest = 0
    for student in existing:
        match = re.search(r"(\d+)$", student.get("code") or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return [f"STU-{highest + offset:03d}" for offset in range(1, count + 1)]


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


# Columns the browser has no use for. `storage_path` in particular describes the
# private bucket's layout and embeds the owner's id — the client fetches sheets
# through /sheets/{id}/file, never by path.
SUBMISSION_PRIVATE = ("storage_path",)


def submission_payload(row: dict) -> dict:
    return {key: value for key, value in row.items() if key not in SUBMISSION_PRIVATE}


def classroom_payload(db: Client, classroom: dict) -> dict:
    classroom_id = classroom["id"]
    subjects = (
        db.table("subjects").select("*").eq("classroom_id", classroom_id).order("position").order("name").execute().data
    )
    students = (
        db.table("classroom_students").select("*").eq("classroom_id", classroom_id).order("code").execute().data
    )
    tests = (
        db.table("tests").select("*").eq("classroom_id", classroom_id).order("test_date", desc=True).execute().data
    )
    test_ids = [test["id"] for test in tests]
    submissions: list[dict] = []
    attendance: list[dict] = []
    if test_ids:
        submissions = [
            submission_payload(row)
            for row in db.table("test_submissions").select("*").in_("test_id", test_ids).execute().data
        ]
        attendance = db.table("test_attendance").select("*").in_("test_id", test_ids).execute().data
    return {
        **classroom,
        "subjects": subjects,
        "students": students,
        "tests": tests,
        "submissions": submissions,
        "attendance": attendance,
    }


# ---------- classrooms ----------


@router.get("/classrooms")
def list_classrooms(user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    classrooms = (
        db.table("classrooms").select("*").eq("owner_id", user["id"]).order("created_at", desc=True).execute().data
    )
    return [classroom_payload(db, classroom) for classroom in classrooms]


@router.post("/classrooms", status_code=status.HTTP_201_CREATED)
def create_classroom(
    payload: ClassroomCreate, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    classroom = (
        db.table("classrooms")
        .insert(
            {
                "owner_id": user["id"],
                "slug": unique_slug(db, user["id"], payload.name),
                "name": payload.name.strip(),
                "description": (payload.description or "").strip() or None,
            }
        )
        .execute()
        .data[0]
    )
    names = [name.strip() for name in payload.subjects if name.strip()]
    if names:
        db.table("subjects").insert(
            [
                {"classroom_id": classroom["id"], "name": name, "position": index}
                for index, name in enumerate(dict.fromkeys(names))
            ]
        ).execute()
    return classroom_payload(db, classroom)


@router.get("/classrooms/{slug}")
def get_classroom(slug: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    return classroom_payload(db, owned_classroom_by_slug(db, slug, user["id"]))


@router.patch("/classrooms/{classroom_id}")
def update_classroom(
    classroom_id: str,
    payload: ClassroomUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_classroom(db, classroom_id, user["id"])
    update: dict[str, Any] = {"updated_at": now_iso()}
    if payload.name is not None:
        update["name"] = payload.name.strip()
    if payload.description is not None:
        update["description"] = payload.description.strip() or None
    if payload.grade_scale is not None:
        update["grade_scale"] = [band.model_dump() for band in payload.grade_scale]
    updated = db.table("classrooms").update(update).eq("id", classroom_id).execute().data[0]
    return classroom_payload(db, updated)


@router.delete("/classrooms/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classroom(
    classroom_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    owned_classroom(db, classroom_id, user["id"])
    tests = db.table("tests").select("id").eq("classroom_id", classroom_id).execute().data
    paths: list[str] = []
    if tests:
        rows = (
            db.table("test_submissions")
            .select("storage_path")
            .in_("test_id", [test["id"] for test in tests])
            .execute()
            .data
        )
        paths = [row["storage_path"] for row in rows if row.get("storage_path")]
    db.table("classrooms").delete().eq("id", classroom_id).execute()
    if paths:
        try:
            SheetStorage(db).delete_many(paths)
        except Exception:
            logger.exception("Could not remove answer sheets for classroom %s", classroom_id)


# ---------- subjects ----------


@router.post("/classrooms/{classroom_id}/subjects", status_code=status.HTTP_201_CREATED)
def create_subject(
    classroom_id: str,
    payload: SubjectCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_classroom(db, classroom_id, user["id"])
    existing = db.table("subjects").select("id").eq("classroom_id", classroom_id).execute().data
    result = (
        db.table("subjects")
        .upsert(
            {"classroom_id": classroom_id, "name": payload.name.strip(), "position": len(existing)},
            on_conflict="classroom_id,name",
        )
        .execute()
    )
    return result.data[0]


@router.patch("/subjects/{subject_id}")
def update_subject(
    subject_id: str,
    payload: SubjectCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    found = db.table("subjects").select("*").eq("id", subject_id).limit(1).execute()
    if not found.data:
        raise HTTPException(status_code=404, detail="Subject not found")
    owned_classroom(db, found.data[0]["classroom_id"], user["id"])
    return (
        db.table("subjects").update({"name": payload.name.strip()}).eq("id", subject_id).execute().data[0]
    )


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    found = db.table("subjects").select("*").eq("id", subject_id).limit(1).execute()
    if not found.data:
        return
    owned_classroom(db, found.data[0]["classroom_id"], user["id"])
    db.table("subjects").delete().eq("id", subject_id).execute()


# ---------- students ----------


@router.post("/classrooms/{classroom_id}/students", status_code=status.HTTP_201_CREATED)
def add_students(
    classroom_id: str,
    payload: StudentsCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_classroom(db, classroom_id, user["id"])
    existing = (
        db.table("classroom_students").select("code,name").eq("classroom_id", classroom_id).execute().data
    )
    taken = {student["name"].strip().lower() for student in existing}

    fresh = []
    for student in payload.students:
        name = student.name.strip()
        if not name or name.lower() in taken:
            continue
        taken.add(name.lower())
        fresh.append({"name": name, "roll_no": (student.roll_no or "").strip() or None})

    if not fresh:
        return []
    codes = next_student_codes(existing, len(fresh))
    rows = [
        {"classroom_id": classroom_id, "code": code, **student}
        for code, student in zip(codes, fresh, strict=True)
    ]
    return db.table("classroom_students").insert(rows).execute().data


@router.post("/classrooms/{classroom_id}/students/extract")
async def extract_students(
    classroom_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    """
    Read a class register into a student list.

    Nothing is written here — the teacher reviews and edits the names before
    they go anywhere, so extraction stays a read and insertion keeps going
    through add_students.
    """
    owned_classroom(db, classroom_id, user["id"])
    content, mime = await read_upload(file)
    try:
        students = SheetGrader().read_roster(content, mime)
    except Exception as error:  # noqa: BLE001 - surfaced to the teacher as a retryable failure
        raise HTTPException(
            status_code=502,
            detail=f"Could not read that register: {error}",
        ) from error
    return {"students": students}


@router.patch("/students/{student_id}")
def update_student(
    student_id: str,
    payload: StudentUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_student(db, student_id, user["id"])
    update: dict[str, Any] = {}
    if payload.name is not None:
        update["name"] = payload.name.strip()
    if payload.roll_no is not None:
        update["roll_no"] = payload.roll_no.strip() or None
    if not update:
        return owned_student(db, student_id, user["id"])[0]
    return db.table("classroom_students").update(update).eq("id", student_id).execute().data[0]


@router.post("/students/{student_id}/rotate-share-link")
def rotate_share_link(
    student_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    """
    Issue a new results link and invalidate the old one.

    A results link exposes a child's marks to anyone holding it, so there has to
    be a way to withdraw one that has been forwarded, posted, or lost.
    """
    owned_student(db, student_id, user["id"])
    updated = (
        db.table("classroom_students")
        .update({"share_token": str(uuid4())})
        .eq("id", student_id)
        .execute()
        .data[0]
    )
    return {"share_token": updated["share_token"]}


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    owned_student(db, student_id, user["id"])
    rows = (
        db.table("test_submissions").select("storage_path").eq("student_id", student_id).execute().data
    )
    db.table("classroom_students").delete().eq("id", student_id).execute()
    paths = [row["storage_path"] for row in rows if row.get("storage_path")]
    if paths:
        try:
            SheetStorage(db).delete_many(paths)
        except Exception:
            logger.exception("Could not remove answer sheets for student %s", student_id)


# ---------- tests ----------


@router.post("/classrooms/{classroom_id}/tests", status_code=status.HTTP_201_CREATED)
def create_test(
    classroom_id: str,
    payload: TestCreate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_classroom(db, classroom_id, user["id"])
    return (
        db.table("tests")
        .insert(
            {
                "classroom_id": classroom_id,
                "subject_id": payload.subject_id or None,
                "test_date": payload.test_date.isoformat(),
                "title": (payload.title or "").strip() or None,
                "instructions": (payload.instructions or "").strip() or None,
                "max_marks": payload.max_marks,
            }
        )
        .execute()
        .data[0]
    )


@router.get("/tests/{test_id}")
def get_test(test_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    test, classroom = owned_test(db, test_id, user["id"])
    return {
        "test": test,
        "classroom": {
            **classroom,
            "subjects": db.table("subjects")
            .select("*")
            .eq("classroom_id", classroom["id"])
            .order("position")
            .order("name")
            .execute()
            .data,
        },
        "students": db.table("classroom_students").select("*").eq("classroom_id", classroom["id"]).order("code").execute().data,
        "submissions": [
            submission_payload(row)
            for row in db.table("test_submissions").select("*").eq("test_id", test_id).execute().data
        ],
        "attendance": db.table("test_attendance").select("*").eq("test_id", test_id).execute().data,
    }


@router.patch("/tests/{test_id}")
def update_test(
    test_id: str,
    payload: TestUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_test(db, test_id, user["id"])
    update: dict[str, Any] = {"updated_at": now_iso()}
    if payload.test_date is not None:
        update["test_date"] = payload.test_date.isoformat()
    if payload.title is not None:
        update["title"] = payload.title.strip() or None
    if payload.instructions is not None:
        update["instructions"] = payload.instructions.strip() or None
    if payload.max_marks is not None:
        update["max_marks"] = payload.max_marks
    update["subject_id"] = payload.subject_id or None
    return db.table("tests").update(update).eq("id", test_id).execute().data[0]


@router.delete("/tests/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test(test_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)):
    owned_test(db, test_id, user["id"])
    rows = db.table("test_submissions").select("storage_path").eq("test_id", test_id).execute().data
    db.table("tests").delete().eq("id", test_id).execute()
    paths = [row["storage_path"] for row in rows if row.get("storage_path")]
    if paths:
        try:
            SheetStorage(db).delete_many(paths)
        except Exception:
            logger.exception("Could not remove answer sheets for test %s", test_id)


# ---------- attendance ----------


@router.post("/tests/{test_id}/attendance")
def set_attendance(
    test_id: str,
    payload: AttendanceUpdate,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    test, classroom = owned_test(db, test_id, user["id"])
    valid = {
        student["id"]
        for student in db.table("classroom_students").select("id").eq("classroom_id", classroom["id"]).execute().data
    }
    rows = [
        {"test_id": test_id, "student_id": entry.student_id, "mark": entry.mark, "updated_at": now_iso()}
        for entry in payload.entries
        if entry.student_id in valid
    ]
    if not rows:
        return []
    db.table("test_attendance").upsert(rows, on_conflict="test_id,student_id").execute()

    # An absent student is not expected to hand anything in, so drop any sheet
    # sitting against them rather than leaving it to be graded.
    absent = [row["student_id"] for row in rows if row["mark"] == "absent"]
    if absent:
        stale = (
            db.table("test_submissions")
            .select("id,storage_path")
            .eq("test_id", test_id)
            .in_("student_id", absent)
            .execute()
            .data
        )
        if stale:
            db.table("test_submissions").delete().eq("test_id", test_id).in_("student_id", absent).execute()
            try:
                SheetStorage(db).delete_many([row["storage_path"] for row in stale if row.get("storage_path")])
            except Exception:
                logger.exception("Could not remove sheets for absent students on test %s", test_id)
    return db.table("test_attendance").select("*").eq("test_id", test_id).execute().data


# ---------- answer sheets ----------


def _present_students(db: Client, test_id: str, classroom_id: str) -> list[dict]:
    students = (
        db.table("classroom_students").select("*").eq("classroom_id", classroom_id).order("code").execute().data
    )
    absent = {
        row["student_id"]
        for row in db.table("test_attendance").select("student_id,mark").eq("test_id", test_id).execute().data
        if row["mark"] == "absent"
    }
    return [student for student in students if student["id"] not in absent]


def _match_by_filename(file_name: str, students: list[dict], taken: set[str]) -> str | None:
    stem = re.sub(r"[^a-z0-9]+", " ", file_name.rsplit(".", 1)[0].lower()).strip()
    for student in students:
        if student["id"] in taken:
            continue
        if student["code"] and re.sub(r"[^a-z0-9]+", " ", student["code"].lower()) in stem:
            return student["id"]
    for student in students:
        if student["id"] in taken:
            continue
        parts = [part for part in re.sub(r"[^a-z0-9]+", " ", student["name"].lower()).split() if len(part) > 2]
        if parts and all(part in stem for part in parts):
            return student["id"]
    digits = re.findall(r"\b(\d{1,4})\b", stem)
    for value in digits:
        for student in students:
            if student["id"] in taken:
                continue
            if student.get("roll_no") and str(int(value)) == student["roll_no"].strip():
                return student["id"]
    return None


@router.post("/tests/{test_id}/submissions", status_code=status.HTTP_201_CREATED)
async def upload_sheets(
    test_id: str,
    background: BackgroundTasks,
    files: list[UploadFile] = File(...),
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    """
    Accept whatever the scanner produced.

    One file per student works. So does a single multi-page PDF holding the
    whole class — it is split by reading the name off each page, which is the
    shape a document scanner or a phone scanning app actually gives you.
    """
    test, classroom = owned_test(db, test_id, user["id"])
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=413,
            detail=f"That is {len(files)} files. Upload at most {MAX_FILES} at a time.",
        )
    students = _present_students(db, test_id, classroom["id"])
    if not students:
        raise HTTPException(status_code=400, detail="Every student is marked absent for this test")

    storage = SheetStorage(db)
    grader = SheetGrader()
    taken: set[str] = set()
    prepared: list[tuple[str, SheetFile, bool]] = []
    unmatched: list[str] = []

    for upload in files:
        content, mime = await read_upload(upload)
        name = upload.filename or "sheet"

        pages = pdf_page_count(content) if mime == "application/pdf" else 1
        if pages > MAX_PDF_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"{name} has {pages} pages. Split it into batches of {MAX_PDF_PAGES} or fewer.",
            )
        if pages > 1 and len(files) == 1:
            # A whole class in one PDF: ask which name is on each page, group
            # continuation pages onto the sheet they belong to, then split.
            try:
                page_names = grader.identify_pages(content, mime, pages)
            except Exception:
                logger.exception("Could not read names from %s", name)
                raise HTTPException(
                    status_code=422,
                    detail="Could not read the names in that PDF. Try uploading one file per student.",
                ) from None
            for first, last, student_name in group_pages_by_student(page_names):
                student_id = match_name_to_student(student_name, [s for s in students if s["id"] not in taken])
                slice_name = f"{slugify(student_name or 'sheet')}-p{first}.pdf"
                sheet = SheetFile(slice_name, mime, extract_pdf_pages(content, first, last), first, last)
                if student_id:
                    taken.add(student_id)
                    prepared.append((student_id, sheet, True))
                else:
                    unmatched.append(f"pages {first}-{last}")
            continue

        student_id = _match_by_filename(name, students, taken)
        sheet = SheetFile(name, mime, content)
        if student_id:
            taken.add(student_id)
            prepared.append((student_id, sheet, False))
        else:
            unmatched.append(name)

    created: list[dict] = []
    for student_id, sheet, by_ai in prepared:
        path = storage.upload(user["id"], test_id, student_id, sheet)
        row = {
            "test_id": test_id,
            "student_id": student_id,
            "file_name": sheet.file_name,
            "storage_path": path,
            "mime_type": sheet.mime_type,
            "source_page_from": sheet.page_from,
            "source_page_to": sheet.page_to,
            "matched_by_ai": by_ai,
            "status": "awaiting",
            "score": None,
            "out_of": None,
            "summary": None,
            "questions": [],
            "needs_review": False,
            "overridden": False,
            "error_message": None,
            "graded_at": None,
            "updated_at": now_iso(),
        }
        created.append(
            submission_payload(
                db.table("test_submissions").upsert(row, on_conflict="test_id,student_id").execute().data[0]
            )
        )

    if created:
        background.add_task(run_grading, test_id, user["id"])

    # Unmatched sheets are reported, never guessed at. Attaching one student's
    # paper to another is the worst mistake this product could make, so the
    # teacher assigns those by uploading them against a student directly.
    return {
        "submissions": created,
        "unmatched": unmatched,
        "awaiting_upload": [
            {"id": student["id"], "name": student["name"], "code": student["code"]}
            for student in students
            if student["id"] not in taken
        ],
    }


@router.get("/sheets/{submission_id}/file")
def get_sheet(
    submission_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    """Serve the answer sheet so a teacher can check a mark against the paper."""
    submission, _, _ = owned_submission(db, submission_id, user["id"])
    if not submission.get("storage_path"):
        raise HTTPException(status_code=404, detail="No answer sheet was stored for this student")
    try:
        content = SheetStorage(db).download(submission["storage_path"])
    except Exception:
        logger.exception("Could not read sheet %s", submission["storage_path"])
        raise HTTPException(status_code=502, detail="Could not read the stored answer sheet") from None
    return Response(
        content=content,
        media_type=submission.get("mime_type") or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{submission.get("file_name") or "sheet"}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.delete("/sheets/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(
    submission_id: str, user=Depends(get_current_user), db: Client = Depends(get_supabase)
):
    submission, _, _ = owned_submission(db, submission_id, user["id"])
    db.table("test_submissions").delete().eq("id", submission_id).execute()
    if submission.get("storage_path"):
        try:
            SheetStorage(db).delete_many([submission["storage_path"]])
        except Exception:
            logger.exception("Could not remove sheet for submission %s", submission_id)


@router.patch("/sheets/{submission_id}")
def review_submission(
    submission_id: str,
    payload: SubmissionReview,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    submission, test, _ = owned_submission(db, submission_id, user["id"])
    update: dict[str, Any] = {"updated_at": now_iso()}
    if payload.score is not None:
        ceiling = float(submission.get("out_of") or test["max_marks"])
        if payload.score > ceiling:
            raise HTTPException(status_code=400, detail=f"That is more than the paper's {ceiling:g} marks")
        update["score"] = payload.score
        update["overridden"] = True
        update["needs_review"] = False
    if payload.accept:
        update["needs_review"] = False
    return submission_payload(
        db.table("test_submissions").update(update).eq("id", submission_id).execute().data[0]
    )


# ---------- grading ----------


def run_grading(test_id: str, owner_id: str, correction: str | None = None) -> None:
    """
    Mark every pending sheet on a test, one at a time.

    Runs as a background task, so it must be safe to start twice and safe to
    resume: work is claimed by flipping a row to `grading`, and every row is
    settled in a finally block so a crash cannot strand a test.
    """
    db = get_supabase()
    storage = SheetStorage(db)
    grader = SheetGrader()

    test = db.table("tests").select("*").eq("id", test_id).limit(1).execute().data
    if not test:
        return
    test = test[0]

    pending = (
        db.table("test_submissions")
        .select("*")
        .eq("test_id", test_id)
        .in_("status", ["awaiting", "failed", "queued"])
        .execute()
        .data
    )
    if not pending:
        return

    db.table("tests").update({"status": "grading", "updated_at": now_iso()}).eq("id", test_id).execute()
    try:
        for submission in pending:
            if not submission.get("storage_path"):
                continue
            db.table("test_submissions").update({"status": "grading", "updated_at": now_iso()}).eq(
                "id", submission["id"]
            ).execute()
            try:
                content = storage.download(submission["storage_path"])
                result = grader.grade(
                    content,
                    submission.get("mime_type") or "application/pdf",
                    float(test["max_marks"]),
                    test.get("instructions"),
                    correction,
                )
                db.table("test_submissions").update(
                    {
                        "status": "graded",
                        "score": result.score,
                        "out_of": result.out_of,
                        "summary": result.summary,
                        "questions": [question.model_dump() for question in result.questions],
                        "needs_review": result.needs_review,
                        "overridden": False,
                        "error_message": result.review_reason,
                        "graded_at": now_iso(),
                        "updated_at": now_iso(),
                    }
                ).eq("id", submission["id"]).execute()
            except Exception:
                logger.exception("Grading failed for submission %s", submission["id"])
                db.table("test_submissions").update(
                    {
                        "status": "failed",
                        "error_message": "Could not read this answer sheet. Try re-uploading it.",
                        "updated_at": now_iso(),
                    }
                ).eq("id", submission["id"]).execute()
    finally:
        remaining = (
            db.table("test_submissions")
            .select("id")
            .eq("test_id", test_id)
            .neq("status", "graded")
            .execute()
            .data
        )
        db.table("tests").update(
            {"status": "collecting" if remaining else "graded", "updated_at": now_iso()}
        ).eq("id", test_id).execute()


@router.post("/tests/{test_id}/grade", status_code=status.HTTP_202_ACCEPTED)
def grade_test(
    test_id: str,
    background: BackgroundTasks,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    owned_test(db, test_id, user["id"])
    background.add_task(run_grading, test_id, user["id"])
    return {"status": "grading"}


@router.post("/tests/{test_id}/regrade", status_code=status.HTTP_202_ACCEPTED)
def regrade_test(
    test_id: str,
    payload: RegradeRequest,
    background: BackgroundTasks,
    user=Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    """
    Re-mark a whole test with a correction.

    When the model was systematically wrong — too harsh about units, say — the
    teacher writes one sentence rather than overriding thirty marks by hand.
    The correction is appended to the test's guidance so it also applies to any
    sheets uploaded later.
    """
    test, _ = owned_test(db, test_id, user["id"])

    query = db.table("test_submissions").select("id").eq("test_id", test_id).eq("status", "graded")
    if payload.only_flagged:
        query = query.eq("needs_review", True)
    targets = query.execute().data
    if not targets:
        raise HTTPException(status_code=400, detail="There is nothing graded to re-mark yet")

    guidance = "\n".join(filter(None, [(test.get("instructions") or "").strip(), payload.correction.strip()]))
    db.table("tests").update({"instructions": guidance, "updated_at": now_iso()}).eq("id", test_id).execute()

    # A teacher's own override is their decision, so re-marking clears it too —
    # they asked for the whole test to be marked again.
    db.table("test_submissions").update(
        {"status": "awaiting", "overridden": False, "updated_at": now_iso()}
    ).in_("id", [row["id"] for row in targets]).execute()

    background.add_task(run_grading, test_id, user["id"], payload.correction.strip())
    return {"status": "grading", "count": len(targets)}


# ---------- marks going somewhere ----------


def grade_for(percent: float | None, scale: list[dict]) -> str | None:
    """Map a percentage onto the classroom's own bands, if it defined any."""
    if percent is None or not scale:
        return None
    for band in scale:
        try:
            if percent >= float(band["min"]):
                return str(band["label"])
        except (KeyError, TypeError, ValueError):
            continue
    return None
