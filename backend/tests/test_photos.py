from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image

from app.services import photos
from app.services.photos import FULL_PX, THUMB_PX, process_image


def make_image(size=(2400, 1800), fmt="JPEG", mode="RGB", color=(200, 160, 60), exif: bytes | None = None) -> bytes:
    buf = BytesIO()
    extra = {"exif": exif} if exif is not None else {}
    Image.new(mode, size, color).save(buf, fmt, **extra)
    return buf.getvalue()


def opened(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data))


def test_resizes_to_gallery_and_thumbnail():
    out = process_image(make_image())
    full, thumb = opened(out.image), opened(out.thumbnail)
    assert full.format == thumb.format == "JPEG"
    assert full.size == (FULL_PX, 1200) == (out.width, out.height)
    assert max(thumb.size) == THUMB_PX


def test_small_images_are_not_enlarged():
    out = process_image(make_image(size=(400, 300)))
    assert (out.width, out.height) == (400, 300)


def test_metadata_is_removed():
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # camera make; GPS lives in the same EXIF block and goes with it
    data = make_image(exif=exif.tobytes())
    assert b"PhoneMaker" in data  # the source really carries metadata
    out = process_image(data)
    for blob in (out.image, out.thumbnail):
        assert not opened(blob).getexif()
        assert b"PhoneMaker" not in blob


def test_exif_rotation_is_applied():
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotate 90 degrees clockwise to display
    out = process_image(make_image(size=(800, 600), exif=exif.tobytes()))
    assert (out.width, out.height) == (600, 800)


def test_transparent_png_gets_white_background():
    out = process_image(make_image(size=(50, 50), fmt="PNG", mode="RGBA", color=(0, 0, 0, 0)))
    assert min(opened(out.image).getpixel((25, 25))) > 240


@pytest.mark.parametrize("data", [b"not an image", b"%PDF-1.4 not an image", make_image(fmt="GIF", mode="P", color=1)])
def test_rejects_anything_but_jpg_or_png(data):
    with pytest.raises(HTTPException) as err:
        process_image(data)
    assert err.value.status_code == 422


def test_rejects_huge_pixel_counts(monkeypatch):
    monkeypatch.setattr(photos, "MAX_PIXELS", 100 * 100)
    with pytest.raises(HTTPException) as err:
        process_image(make_image(size=(200, 200)))
    assert err.value.status_code == 422 and "too large" in err.value.detail
