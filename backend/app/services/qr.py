from io import BytesIO

import qrcode
from PIL import Image, ImageDraw, ImageFont
from qrcode.constants import ERROR_CORRECT_Q

TARGET_QR_PX = 1200  # ~4 in at 300 dpi — comfortably printable on a tag or certificate card.
INK = (23, 63, 53)  # brand emerald #173F35
MUTED = (110, 116, 112)


def _font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow without scalable default font
        return ImageFont.load_default()


def render_qr_png(url: str, caption: str | None = None) -> bytes:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    modules = qr.modules_count + qr.border * 2
    qr.box_size = max(10, TARGET_QR_PX // modules)
    qr_img = qr.make_image(fill_color=INK, back_color="white").convert("RGB")

    if not caption:
        out = BytesIO()
        qr_img.save(out, format="PNG", dpi=(300, 300))
        return out.getvalue()

    w, h = qr_img.size
    title_font, sub_font = _font(w // 14), _font(w // 30)
    canvas = Image.new("RGB", (w, h + w // 5), "white")
    canvas.paste(qr_img, (0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.text((w / 2, h), caption, font=title_font, fill=INK, anchor="mt")
    draw.text((w / 2, h + w // 10), "Scan to verify this jewellery", font=sub_font, fill=MUTED, anchor="mt")

    out = BytesIO()
    canvas.save(out, format="PNG", dpi=(300, 300))
    return out.getvalue()
