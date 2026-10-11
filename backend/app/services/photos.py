"""Photos of stores, pieces and designs. Every upload is re-encoded at two sizes: a gallery image and a
thumbnail for cards and the feed. Saving a fresh JPEG drops all metadata, including a phone's GPS location."""
from dataclasses import dataclass
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import get_settings

FULL_PX = 1600
THUMB_PX = 600
QUALITY = 82
# Checked from the header before decoding, so a small file can't expand into gigabytes of pixels.
MAX_PIXELS = 60_000_000


@dataclass
class ProcessedImage:
    image: bytes
    thumbnail: bytes
    width: int
    height: int


def _reject(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message)


def _fit(img: Image.Image, px: int) -> Image.Image:
    copy = img.copy()
    copy.thumbnail((px, px), Image.Resampling.LANCZOS)  # only ever shrinks
    return copy


def _jpeg(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def process_image(data: bytes) -> ProcessedImage:
    try:
        img = Image.open(BytesIO(data))
        if img.format not in ("JPEG", "PNG"):
            raise _reject("Photos must be JPG or PNG")
        if img.width * img.height > MAX_PIXELS:
            raise _reject("That image is too large. Use a photo under 60 megapixels")
        img = ImageOps.exif_transpose(img)  # phone photos store "rotate me" in EXIF
        img.load()
    except Image.DecompressionBombError:
        raise _reject("That image is too large. Use a photo under 60 megapixels") from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise _reject("That file isn't a readable JPG or PNG image") from None

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        flat = Image.new("RGB", rgba.size, "white")
        flat.paste(rgba, mask=rgba.getchannel("A"))
        img = flat
    else:
        img = img.convert("RGB")

    full = _fit(img, FULL_PX)
    return ProcessedImage(image=_jpeg(full), thumbnail=_jpeg(_fit(img, THUMB_PX)), width=full.width, height=full.height)


async def read_upload(upload: UploadFile) -> bytes:
    limit_mb = get_settings().max_upload_mb
    data = await upload.read(limit_mb * 1024 * 1024 + 1)
    if len(data) > limit_mb * 1024 * 1024:
        raise _reject(f"Photo must be {limit_mb} MB or smaller")
    return data
