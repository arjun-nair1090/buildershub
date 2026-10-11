import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CertificateFile

# Extension -> (accepted MIME types, magic-byte prefix). The content itself is checked,
# not just the filename, so a renamed executable is rejected.
ALLOWED = {
    ".pdf": ({"application/pdf"}, b"%PDF-"),
    ".png": ({"image/png"}, b"\x89PNG\r\n\x1a\n"),
    ".jpg": ({"image/jpeg", "image/jpg", "image/pjpeg"}, b"\xff\xd8\xff"),
    ".jpeg": ({"image/jpeg", "image/jpg", "image/pjpeg"}, b"\xff\xd8\xff"),
}

MEDIA_TYPES = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def _reject(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)


CERTIFICATE_TYPES = (".pdf", ".png", ".jpg", ".jpeg")


async def _save(db: Session, upload: UploadFile, label: str, extensions: tuple[str, ...], kinds: str) -> str:
    """Validate the upload and stage it in the session; the caller commits."""
    settings = get_settings()
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in extensions:
        raise _reject(f"{label} must be a {kinds} file")
    mime_types, magic = ALLOWED[ext]
    if upload.content_type not in mime_types:
        raise _reject("File type does not match its extension")

    limit = settings.max_upload_mb * 1024 * 1024
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise _reject(f"{label} must be {settings.max_upload_mb} MB or smaller")
    if not data.startswith(magic):
        raise _reject(f"File contents are not a valid {kinds}")

    stored_name = f"{uuid.uuid4().hex}{'.jpg' if ext == '.jpeg' else ext}"
    db.add(CertificateFile(name=stored_name, data=data))
    return stored_name


async def save_certificate(db: Session, upload: UploadFile) -> str:
    return await _save(db, upload, "Certificate", CERTIFICATE_TYPES, "PDF, JPG or PNG")


def load_file(db: Session, stored_name: str) -> bytes:
    row = db.get(CertificateFile, stored_name)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return row.data


def delete_file(db: Session, stored_name: str | None) -> None:
    if stored_name:
        db.execute(delete(CertificateFile).where(CertificateFile.name == stored_name))
