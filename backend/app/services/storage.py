from uuid import uuid4

from fastapi import HTTPException, UploadFile
from supabase import Client

from app.core.config import get_settings

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024


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
        extension = (file.filename or "submission").split(".")[-1].lower()
        path = f"{owner_id}/{assignment_id}/{uuid4()}.{extension}"
        self.db.storage.from_(self.settings.supabase_storage_bucket).upload(
            path=path,
            file=content,
            file_options={"content-type": file.content_type, "upsert": "false"},
        )
        return path

    def download(self, path: str) -> bytes:
        return self.db.storage.from_(self.settings.supabase_storage_bucket).download(path)
