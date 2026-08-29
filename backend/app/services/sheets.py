"""
Answer-sheet storage and ingestion.

Two jobs: keep uploaded sheets in a private bucket so a teacher can look at the
paper while reviewing a mark, and turn whatever the scanner produced into one
sheet per student — including the common case where the whole class arrives as
a single multi-page PDF.
"""

from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from supabase import Client

BUCKET = "answer-sheets"
MAX_BYTES = 25 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}


@dataclass
class SheetFile:
    """One student's sheet, ready to store."""

    file_name: str
    mime_type: str
    content: bytes
    page_from: int | None = None
    page_to: int | None = None


class SheetStorage:
    def __init__(self, db: Client) -> None:
        self.db = db

    def _bucket(self):
        return self.db.storage.from_(BUCKET)

    def upload(self, owner_id: str, test_id: str, student_id: str, sheet: SheetFile) -> str:
        path = f"{owner_id}/{test_id}/{student_id}-{_safe_name(sheet.file_name)}"
        self._bucket().upload(
            path,
            sheet.content,
            {"content-type": sheet.mime_type, "upsert": "true"},
        )
        return path

    def download(self, storage_path: str) -> bytes:
        return self._bucket().download(storage_path)

    def delete_many(self, paths: list[str]) -> None:
        cleaned = [path for path in paths if path]
        if cleaned:
            self._bucket().remove(cleaned)


def _safe_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", normalized).strip("-")
    return (cleaned or "sheet")[:80]


async def read_upload(file: UploadFile) -> tuple[bytes, str]:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail=f"{file.filename} is empty")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"{file.filename} is larger than 25MB")
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED:
        raise HTTPException(
            status_code=415,
            detail=f"{file.filename} is a {mime or 'unknown'} file. Upload images or PDFs.",
        )
    return content, mime


def pdf_page_count(content: bytes) -> int:
    from pypdf import PdfReader

    return len(PdfReader(io.BytesIO(content)).pages)


def extract_pdf_pages(content: bytes, first: int, last: int) -> bytes:
    """Slice an inclusive, 1-based page range into a standalone PDF."""
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(content))
    writer = PdfWriter()
    for index in range(first - 1, min(last, len(reader.pages))):
        writer.add_page(reader.pages[index])
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def group_pages_by_student(names: list[str | None]) -> list[tuple[int, int, str | None]]:
    """
    Turn a per-page list of detected names into contiguous per-student ranges.

    A page with no readable name continues the previous student, which is what a
    multi-page answer booklet looks like: the name is on the front sheet only.
    Returns 1-based inclusive `(first_page, last_page, name)` tuples.
    """
    groups: list[tuple[int, int, str | None]] = []
    for index, name in enumerate(names, start=1):
        normalized = (name or "").strip() or None
        if groups and (normalized is None or normalized == groups[-1][2]):
            first, _, current = groups[-1]
            groups[-1] = (first, index, current or normalized)
        else:
            groups.append((index, index, normalized))
    return groups


def match_name_to_student(name: str | None, students: list[dict]) -> str | None:
    """Best-effort name → student id. Exact, then surname/first-name overlap."""
    if not name:
        return None
    target = _normalize(name)
    if not target:
        return None

    for student in students:
        if _normalize(student["name"]) == target:
            return student["id"]

    target_parts = set(target.split())
    best: tuple[int, str] | None = None
    for student in students:
        parts = set(_normalize(student["name"]).split())
        overlap = len(target_parts & parts)
        if overlap and (best is None or overlap > best[0]):
            best = (overlap, student["id"])
    return best[1] if best else None


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", value.lower()).strip()
