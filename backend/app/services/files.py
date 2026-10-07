import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings

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


async def save_certificate(upload: UploadFile) -> str:
    settings = get_settings()
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise _reject("Certificate must be a PDF, JPG or PNG file")
    mime_types, magic = ALLOWED[ext]
    if upload.content_type not in mime_types:
        raise _reject("File type does not match its extension")

    limit = settings.max_upload_mb * 1024 * 1024
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise _reject(f"Certificate must be {settings.max_upload_mb} MB or smaller")
    if not data.startswith(magic):
        raise _reject("File contents are not a valid PDF, JPG or PNG")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{'.jpg' if ext == '.jpeg' else ext}"
    (settings.upload_dir / stored_name).write_bytes(data)
    return stored_name


def certificate_path(stored_name: str) -> Path:
    settings = get_settings()
    path = (settings.upload_dir / stored_name).resolve()
    if settings.upload_dir.resolve() not in path.parents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return path


def delete_certificate(stored_name: str | None) -> None:
    if stored_name:
        certificate_path(stored_name).unlink(missing_ok=True)
