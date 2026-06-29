from uuid import uuid4

from fastapi import HTTPException, UploadFile
from supabase import Client

from app.core.config import get_settings

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024
EXTENSIONS_BY_MIME_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


def detected_mime_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    return None


class SubmissionStorage:
    def __init__(self, db: Client):
        self.db = db
        self.settings = get_settings()

    async def upload(self, owner_id: str, assignment_id: str, file: UploadFile) -> str:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, WebP, or PDF")
        content = await file.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File must be 10 MB or smaller")
        mime_type = detected_mime_type(content)
        if mime_type != file.content_type:
            raise HTTPException(status_code=415, detail="File contents do not match the declared file type")
        extension = EXTENSIONS_BY_MIME_TYPE[mime_type]
        path = f"{owner_id}/{assignment_id}/{uuid4()}.{extension}"
        self.db.storage.from_(self.settings.supabase_storage_bucket).upload(
            path=path,
            file=content,
            file_options={"content-type": mime_type, "upsert": "false"},
        )
        return path

    def download(self, path: str) -> bytes:
        return self.db.storage.from_(self.settings.supabase_storage_bucket).download(path)

    def delete_many(self, paths: list[str]) -> None:
        if paths:
            self.db.storage.from_(self.settings.supabase_storage_bucket).remove(paths)
