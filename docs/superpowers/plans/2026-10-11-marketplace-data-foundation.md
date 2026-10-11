# Marketplace Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-shop data model into stores, pieces and designs, with verification levels, live prices with discounts, several processed photos per item, and admin screens for all of it.

**Architecture:** FastAPI + SQLAlchemy 2 backend with one Alembic migration (0005) that moves existing pieces onto a placeholder store. Pricing is a single pure function (`piece_price`) used by every endpoint that shows a price. Photos go through one Pillow pipeline (resize, re-encode, strip EXIF) and are served from one cacheable endpoint. The React admin gains Stores and Designs sections and a shared photo manager; the buyer QR page adapts to the new fields.

**Tech Stack:** Python 3.11, FastAPI 0.115, SQLAlchemy 2.0, Alembic 1.14, Pydantic 2.10, Pillow 11, pytest; React 19, TypeScript, Vite, Tailwind v4, react-hook-form + zod 4, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-11-marketplace-data-foundation-design.md`

## Global Constraints

- Every existing Jewellery ID and verification token stays unchanged; `/verify/{token}` keeps working for every published, active piece.
- Verification levels are exactly `declared`, `hallmark`, `lab`; buyer labels "Declared by store", "Hallmark linked", "Lab verified".
- Stock statuses are exactly `in_stock`, `reserved`, `sold`. Discount types are exactly `percent`, `flat`.
- Percent discount 1 to 90; flat discount above 0 and below the registered `total_price`; any discount capped at 90% of the original price at each end.
- Discount ends at the end of `discount_ends_on` in Indian time (UTC+05:30, no DST); ignored for sold pieces.
- Every price line is rounded to whole rupees before it is added, so the breakdown adds up exactly.
- Pieces and designs: 1 to 6 photos (at least one to publish); stores: up to 6. Photos are JPEG at most 1600 px (gallery) and 600 px (thumbnail), quality 82, no EXIF.
- Photo bytes are served with `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` when the owner is visible to buyers, and `private, no-store` (admin only) otherwise.
- The placeholder store: address "Placeholder address, Zaveri Bazaar, Mumbai", area "Zaveri Bazaar", city "Mumbai", latitude 18.951700, longitude 72.833100, hours "Placeholder: Mon-Sat 11 am - 8 pm", phone and WhatsApp empty, name from the old store setting or "Your Store Name".
- Validation errors return 422 as `{"detail": "...", "fields": {"field": "message"}}`; field-specific rules must populate `fields`.
- Commit messages: plain imperative sentences like the existing history ("Add …"). Never mention Claude, Claude Code or AI assistance; no co-author trailers.
- Backend tests run with `.venv/Scripts/python -m pytest -q` from `backend/` (Windows, Git Bash). Frontend checks run with `npx tsc -b` and `npm run build` from `frontend/`.

Two names differ from the spec, for clarity and safety: the photo byte columns are `image` and `thumbnail` (`full` is a reserved word in Postgres), and the photo's piece foreign key is `piece_id` (`jewellery_id` already means the public ID string). URLs still use the sizes `full` and `thumb`.

## Review Focus

1. A phone photo taken in portrait carries an EXIF orientation tag; buyers must see it upright, not sideways. (Task 2: `test_exif_rotation_is_applied`)
2. A PNG with a transparent background must get a white background, not black. (Task 2: `test_transparent_png_gets_white_background`)
3. A tiny file that decodes to an enormous image must be rejected with 422, not crash or exhaust memory. (Task 2: `test_rejects_huge_pixel_counts`)
4. A discount whose end date is today must still show today; it disappears from tomorrow. (Task 1: `test_discount_ending_today_still_applies`)
5. Two stores with the same name must both save, with distinct web addresses. (Task 4: `test_duplicate_names_get_distinct_slugs`)

---

## File structure

**Backend (create)**
- `backend/app/errors.py`: `field_error()` for database-dependent rules in the standard 422 shape.
- `backend/app/services/photos.py`: image processing (`process_image`, `read_upload`) and `photo_out`.
- `backend/app/routers/stores.py`: store admin API.
- `backend/app/routers/photos.py`: photo upload, order, alt text, delete, and byte serving for all owners.
- `backend/app/routers/designs.py`: design admin API.
- `backend/alembic/versions/0005_marketplace_foundation.py`: the migration.
- `backend/tests/test_pricing.py`, `test_photos.py`, `test_migrations.py`, `test_stores.py`, `test_photo_api.py`, `test_designs.py`, `test_seed.py`.

**Backend (modify)**
- `app/constants.py`, `app/models.py`, `app/schemas.py`, `app/deps.py`, `app/main.py`
- `app/services/pricing.py` (adds `piece_price`; removes `live_price`), `app/services/store.py` (rename to `get_store_settings`), `app/services/gold_rate.py`, `app/services/identifiers.py`
- `app/routers/jewellery.py`, `app/routers/verify.py`, `app/routers/settings.py`
- `seed.py`, `tests/conftest.py`, `tests/test_api.py`, `README.md`

**Frontend (create)**
- `src/services/stores.ts`, `src/services/designs.ts`, `src/services/photos.ts`
- `src/hooks/useAdminImage.ts` (replaces `usePhoto.ts`), `src/hooks/useStores.ts`
- `src/components/photos/PhotoManager.tsx`
- `src/components/stores/storeSchema.ts`, `src/pages/admin/StoreListPage.tsx`, `src/pages/admin/StoreFormPage.tsx`
- `src/components/designs/designSchema.ts`, `src/pages/admin/DesignListPage.tsx`, `src/pages/admin/DesignFormPage.tsx`
- `src/components/jewellery/DiscountPreview.tsx`, `src/components/jewellery/savePiece.ts`

**Frontend (modify)**
- `src/types/index.ts`, `src/services/jewellery.ts`, `src/services/verify.ts`, `src/services/settings.ts`, `src/utils/format.ts`
- `src/App.tsx`, `src/components/layout/AdminLayout.tsx`
- `src/components/jewellery/jewellerySchema.ts`, `JewelleryForm.tsx`, `JewelleryTable.tsx`, `PriceBreakdown.tsx`, `StatusBadge.tsx` (gains `LevelBadge` and `ListingBadge`, loses `VerificationBadge`)
- `src/pages/admin/AddJewelleryPage.tsx`, `EditJewelleryPage.tsx`, `JewelleryDetailPage.tsx`, `JewelleryListPage.tsx`, `DashboardPage.tsx`, `SettingsPage.tsx`
- `src/pages/VerifyPage.tsx`, `src/pages/LandingPage.tsx` (the example price breakdown)
- Delete: `src/components/jewellery/PhotoUpload.tsx`, `src/hooks/usePhoto.ts`

---

### Task 1: Price with discount (pure function)

**Files:**
- Modify: `backend/app/schemas.py` (add `PriceDiscount`, `PiecePrice`)
- Modify: `backend/app/services/pricing.py` (add `IST`, `today_ist`, `format_inr`, `discount_label`, `Priceable`, `piece_price`, `PricingContext`, `pricing_context`)
- Test: `backend/tests/test_pricing.py`

**Interfaces:**
- Consumes: `RateSnapshot` and `current_rate(db)` from `app/services/gold_rate.py`; `karat_rate`, `_rupees`, `HUNDRED` already in `pricing.py`; `get_store(db)` from `app/services/store.py` (renamed in Task 3; until then use `get_store`).
- Produces:
  - `piece_price(piece: Priceable, rate: RateSnapshot | None, gst_percent: Decimal, today: date) -> PiecePrice`
  - `PricingContext(rate, gst_percent, today)` dataclass and `pricing_context(db) -> PricingContext`
  - `today_ist() -> date`, `format_inr(amount: Decimal) -> str` ("₹1,25,000"), `discount_label(kind: str, value: Decimal) -> str`
  - Schemas `PriceDiscount` and `PiecePrice` (fields below)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_pricing.py`:

```python
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D

import pytest

from app.services.gold_rate import RateSnapshot
from app.services.pricing import format_inr, piece_price

FETCHED = datetime(2026, 10, 11, 5, 0, tzinfo=timezone.utc)
RATE = RateSnapshot(inr_per_gram_24k=D("10000"), previous=None, fetched_at=FETCHED, source="test")
TODAY = date(2026, 10, 11)
GST = D("3")


@dataclass
class Piece:
    purity: str = "22K"
    net_weight: D = D("10")
    gold_value: D = D("90000")
    making_charges: D = D("9000")
    other_component_value: D = D("1000")
    tax: D = D("3000")
    making_percent_min: D | None = D("10")
    making_percent_max: D | None = D("15")
    discount_type: str | None = None
    discount_value: D | None = None
    discount_ends_on: date | None = None
    stock_status: str = "in_stock"
    updated_at: datetime = datetime(2026, 10, 1, tzinfo=timezone.utc)


def test_live_price_without_discount():
    p = piece_price(Piece(), RATE, GST, TODAY)
    assert p.basis == "live" and p.as_of == FETCHED
    assert p.rate_per_gram == D("9160.00")
    assert p.gold == 91600
    assert (p.making_min, p.making_max) == (9160, 13740)
    assert (p.making_percent_min, p.making_percent_max) == (D("10"), D("15"))
    assert (p.tax_min, p.tax_max) == (3053, 3190)
    assert (p.original_min, p.original_max) == (104813, 109530)
    assert p.discount is None
    assert (p.final_min, p.final_max) == (104813, 109530)


def test_fixed_making_when_no_range():
    p = piece_price(Piece(making_percent_min=None, making_percent_max=None), RATE, GST, TODAY)
    assert (p.making_min, p.making_max) == (9000, 9000)
    assert (p.making_percent_min, p.making_percent_max) == (None, None)
    assert p.original_min == p.original_max == 91600 + 9000 + 1000 + 3048


def test_percent_discount():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10.00")), RATE, GST, TODAY)
    assert p.discount.label == "10% off" and p.discount.type == "percent"
    assert (p.discount.amount_min, p.discount.amount_max) == (10481, 10953)
    assert (p.final_min, p.final_max) == (94332, 98577)


def test_flat_discount():
    p = piece_price(Piece(discount_type="flat", discount_value=D("5000")), RATE, GST, TODAY)
    assert p.discount.label == "₹5,000 off"
    assert (p.final_min, p.final_max) == (99813, 104530)


def test_discount_capped_at_90_percent():
    p = piece_price(Piece(discount_type="flat", discount_value=D("200000")), RATE, GST, TODAY)
    assert (p.discount.amount_min, p.discount.amount_max) == (94332, 98577)
    assert (p.final_min, p.final_max) == (10481, 10953)


def test_expired_discount_is_ignored():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), discount_ends_on=TODAY - timedelta(days=1)),
                    RATE, GST, TODAY)
    assert p.discount is None and p.final_min == p.original_min


def test_discount_ending_today_still_applies():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), discount_ends_on=TODAY), RATE, GST, TODAY)
    assert p.discount is not None and p.discount.ends_on == TODAY


def test_sold_piece_shows_no_discount():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), stock_status="sold"), RATE, GST, TODAY)
    assert p.discount is None


def test_registered_fallback_without_a_rate():
    piece = Piece(discount_type="percent", discount_value=D("10"))
    p = piece_price(piece, None, GST, TODAY)
    assert p.basis == "registered" and p.as_of == piece.updated_at and p.rate_per_gram is None
    assert (p.gold, p.making_min, p.making_max, p.other, p.tax_min) == (90000, 9000, 9000, 1000, 3000)
    assert (p.making_percent_min, p.making_percent_max) == (None, None)
    assert p.original_min == p.original_max == 103000
    assert p.final_min == p.final_max == 92700


@pytest.mark.parametrize("weight", ["0.5", "4.88", "10.76", "25.94", "123.456"])
@pytest.mark.parametrize("rate", ["9999.99", "13687.82", "14943.02"])
@pytest.mark.parametrize("discount", [None, ("percent", "7.5"), ("flat", "1234.56")])
def test_lines_add_up(weight, rate, discount):
    piece = Piece(net_weight=D(weight), other_component_value=D("1234.56"))
    if discount:
        piece.discount_type, piece.discount_value = discount[0], D(discount[1])
    p = piece_price(piece, RateSnapshot(D(rate), None, FETCHED, "test"), GST, TODAY)
    for end in ("min", "max"):
        original = getattr(p, f"original_{end}")
        assert p.gold + getattr(p, f"making_{end}") + p.other + getattr(p, f"tax_{end}") == original
        amount = getattr(p.discount, f"amount_{end}") if p.discount else 0
        final = getattr(p, f"final_{end}")
        assert original - amount == final
        assert final == final.to_integral_value()


@pytest.mark.parametrize("amount, text", [
    (D("0"), "₹0"), (D("999"), "₹999"), (D("5000"), "₹5,000"),
    (D("125000"), "₹1,25,000"), (D("12345678.40"), "₹1,23,45,678"),
])
def test_format_inr(amount, text):
    assert format_inr(amount) == text
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_pricing.py -q`
Expected: FAIL with `ImportError: cannot import name 'format_inr'`.

- [ ] **Step 3: Add the price schemas**

In `backend/app/schemas.py`, add `DiscountType` next to the other `Literal` aliases at the top:

```python
DiscountType = Literal["percent", "flat"]
```

and add these classes in the `# ---------- Public verification ----------` section, above `class LivePrice`:

```python
class PriceDiscount(BaseModel):
    type: DiscountType
    value: Decimal
    label: str  # "10% off" or "₹5,000 off"
    amount_min: Decimal
    amount_max: Decimal
    ends_on: date | None


class PiecePrice(BaseModel):
    """A piece's price right now. Every line is in whole rupees and the lines add up exactly:
    gold + making + other + tax = original; original - discount = final. min equals max when
    making charges are a single amount."""

    basis: Literal["live", "registered"]
    as_of: datetime
    rate_per_gram: Decimal | None  # for the piece's purity; None on the registered basis
    gold: Decimal
    making_min: Decimal
    making_max: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    other: Decimal
    gst_percent: Decimal
    tax_min: Decimal
    tax_max: Decimal
    original_min: Decimal
    original_max: Decimal
    discount: PriceDiscount | None
    final_min: Decimal
    final_max: Decimal
```

- [ ] **Step 4: Implement `piece_price`**

In `backend/app/services/pricing.py`, replace the imports block with:

```python
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.models import Jewellery
from app.schemas import GoldRateOut, LivePrice, PiecePrice, PriceDiscount
from app.services.gold_rate import RateSnapshot, current_rate
from app.services.store import get_store

HUNDRED = Decimal("100")
# India has one time zone and no daylight saving, so a fixed offset is exact (and needs no tz database).
IST = timezone(timedelta(hours=5, minutes=30), "IST")
MAX_DISCOUNT_PERCENT = Decimal("90")
```

Append to the end of the file:

```python
def today_ist() -> date:
    return datetime.now(IST).date()


def format_inr(amount: Decimal) -> str:
    """₹1,25,000: whole rupees, Indian digit grouping."""
    digits = str(abs(int(_rupees(Decimal(amount)))))
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return "₹" + ",".join([*groups, tail])


def discount_label(kind: str, value: Decimal) -> str:
    if kind == "percent":
        return f"{format(Decimal(value).normalize(), 'f')}% off"
    return f"{format_inr(value)} off"


class Priceable(Protocol):
    purity: str
    net_weight: Decimal
    gold_value: Decimal
    making_charges: Decimal
    other_component_value: Decimal
    tax: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    discount_type: str | None
    discount_value: Decimal | None
    discount_ends_on: date | None
    stock_status: str
    updated_at: datetime


def _discount_applies(piece: Priceable, today: date) -> bool:
    return (
        piece.discount_type is not None
        and piece.discount_value is not None
        and piece.stock_status != "sold"
        and (piece.discount_ends_on is None or piece.discount_ends_on >= today)
    )


def _discount_amount(piece: Priceable, original: Decimal) -> Decimal:
    if piece.discount_type == "percent":
        amount = _rupees(original * piece.discount_value / HUNDRED)
    else:
        amount = _rupees(piece.discount_value)
    return min(amount, _rupees(original * MAX_DISCOUNT_PERCENT / HUNDRED))


def piece_price(piece: Priceable, rate: RateSnapshot | None, gst_percent: Decimal, today: date) -> PiecePrice:
    """The one place prices are worked out, so every page shows the same numbers."""
    if rate is not None:
        per_gram = karat_rate(rate.inr_per_gram_24k, piece.purity)
        gold = _rupees(piece.net_weight * per_gram)
        ranged = piece.making_percent_min is not None and piece.making_percent_max is not None
        if ranged:
            making_min = _rupees(gold * piece.making_percent_min / HUNDRED)
            making_max = _rupees(gold * piece.making_percent_max / HUNDRED)
        else:
            making_min = making_max = _rupees(piece.making_charges)
        other = _rupees(piece.other_component_value)
        tax_min = _rupees((gold + making_min + other) * gst_percent / HUNDRED)
        tax_max = _rupees((gold + making_max + other) * gst_percent / HUNDRED)
        basis, as_of = "live", rate.fetched_at
    else:
        # No rate has ever been fetched: the registered amounts are the price.
        per_gram, ranged = None, False
        gold = _rupees(piece.gold_value)
        making_min = making_max = _rupees(piece.making_charges)
        other = _rupees(piece.other_component_value)
        tax_min = tax_max = _rupees(piece.tax)
        basis, as_of = "registered", piece.updated_at

    original_min = gold + making_min + other + tax_min
    original_max = gold + making_max + other + tax_max

    discount = None
    final_min, final_max = original_min, original_max
    if _discount_applies(piece, today):
        amount_min = _discount_amount(piece, original_min)
        amount_max = _discount_amount(piece, original_max)
        discount = PriceDiscount(
            type=piece.discount_type,
            value=piece.discount_value,
            label=discount_label(piece.discount_type, piece.discount_value),
            amount_min=amount_min,
            amount_max=amount_max,
            ends_on=piece.discount_ends_on,
        )
        final_min, final_max = original_min - amount_min, original_max - amount_max

    return PiecePrice(
        basis=basis,
        as_of=as_of,
        rate_per_gram=per_gram,
        gold=gold,
        making_min=making_min,
        making_max=making_max,
        making_percent_min=piece.making_percent_min if ranged else None,
        making_percent_max=piece.making_percent_max if ranged else None,
        other=other,
        gst_percent=gst_percent,
        tax_min=tax_min,
        tax_max=tax_max,
        original_min=original_min,
        original_max=original_max,
        discount=discount,
        final_min=final_min,
        final_max=final_max,
    )


@dataclass
class PricingContext:
    """What every price on a request shares: one rate lookup, the store-wide GST, today's date."""

    rate: RateSnapshot | None
    gst_percent: Decimal
    today: date


def pricing_context(db: Session) -> PricingContext:
    return PricingContext(rate=current_rate(db), gst_percent=get_store(db).gst_percent, today=today_ist())
```

`format_inr` rounds half up, so `D("12345678.40")` gives `₹1,23,45,678`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_pricing.py -q`
Expected: PASS (all pricing tests). Then run the whole suite: `.venv/Scripts/python -m pytest -q`. Expected: all pass (nothing else uses the new code yet).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/services/pricing.py backend/tests/test_pricing.py
git commit -m "Add piece pricing with discounts"
```

---

### Task 2: Photo processing

**Files:**
- Create: `backend/app/services/photos.py`
- Test: `backend/tests/test_photos.py`

**Interfaces:**
- Consumes: `get_settings().max_upload_mb`.
- Produces:
  - `FULL_PX = 1600`, `THUMB_PX = 600`, `MAX_PIXELS = 60_000_000`
  - `ProcessedImage(image: bytes, thumbnail: bytes, width: int, height: int)` (width/height of `image`)
  - `process_image(data: bytes) -> ProcessedImage`, raising `HTTPException(422)` for anything that isn't a usable JPG/PNG
  - `async read_upload(upload: UploadFile) -> bytes`, raising 422 above `MAX_UPLOAD_MB`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_photos.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_photos.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.photos'`.

- [ ] **Step 3: Implement the service**

Create `backend/app/services/photos.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_photos.py -q`
Expected: PASS (7 tests, 9 with parametrisation).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/photos.py backend/tests/test_photos.py
git commit -m "Add photo processing for uploads"
```

---
### Task 3: Data model, migration 0005, and pieces on the new model

The model change forces the piece API, the verify API and the settings API to change together, so they are one task. The suite is green again at the end of the task.

**Files:**
- Modify: `backend/app/constants.py`, `backend/app/models.py`, `backend/app/schemas.py`
- Create: `backend/alembic/versions/0005_marketplace_foundation.py`, `backend/app/errors.py`
- Modify: `backend/app/services/store.py` (rename), `backend/app/services/gold_rate.py`, `backend/app/services/pricing.py`, `backend/app/services/photos.py` (add `photo_out`), `backend/app/services/files.py`
- Modify: `backend/app/routers/jewellery.py`, `backend/app/routers/verify.py`, `backend/app/routers/settings.py`, `backend/seed.py` (rename only)
- Test: `backend/tests/test_migrations.py` (create), `backend/tests/conftest.py`, `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `piece_price`, `PricingContext`, `pricing_context`, `PiecePrice` (Task 1); `app/services/photos.py` (Task 2).
- Produces:
  - Models `Store`, `Design`, `Photo` and the extended `Jewellery`; properties `Jewellery.is_active`, `Design.is_visible`, `Design.purities`.
  - `get_store_settings(db) -> StoreSettings` (renamed from `get_store`).
  - `field_error(field: str, message: str) -> RequestValidationError` in `app/errors.py`.
  - `photo_out(photo: Photo, title: str) -> PhotoOut` in `app/services/photos.py`.
  - Schemas `Slug`, `VerificationLevel`, `StockStatus`, `StoreRef`, `PhotoOut`, `PricePreviewIn`; reshaped `JewelleryIn`, `JewelleryOut`, `JewelleryStats`, `PublicVerification`, `StoreSettingsIn/Out`.
  - API: `POST /api/jewellery/price-preview`; list filters `store`, `published`, `stock`.
  - Test fixtures in `conftest.py`: `TEST_STORE = "test-store"`, `db`, `add_photo(jewellery_id)`, `publish(**overrides) -> dict`.

- [ ] **Step 1: Write the failing migration tests**

Create `backend/tests/test_migrations.py`:

```python
"""Migration 0005 on a real file database, with data shaped like production's."""
from io import BytesIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from PIL import Image
from sqlalchemy import create_engine, text

from app.config import get_settings

BACKEND = Path(__file__).resolve().parent.parent
BEFORE = "0004_store_and_live_pricing"


@pytest.fixture()
def migrate(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'migrate.db').as_posix()}"
    monkeypatch.setattr(get_settings(), "database_url", url)  # alembic/env.py reads the URL from settings
    # No ini file: alembic.ini's logging config would otherwise switch off the app's loggers for later tests.
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    engine = create_engine(url)
    yield cfg, engine
    engine.dispose()


def png(size=(300, 400)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, (180, 140, 60)).save(buf, "PNG")
    return buf.getvalue()


def seed_before(engine) -> None:
    with engine.begin() as c:
        c.execute(text("UPDATE store_settings SET store_name = 'Old Name Jewellers' WHERE id = 1"))
        c.execute(text("INSERT INTO certificate_files (name, data) VALUES ('p1.png', :d)"), {"d": png()})
        rows = [
            (1, "Nakshi kada in 22K gold", "Bangle", None, "p1.png"),
            (2, "Wedding band", "Ring", "HM-1", None),
        ]
        for pk, desc, kind, cert, photo in rows:
            c.execute(
                text(
                    "INSERT INTO jewellery (id, jewellery_id, verification_token, type, description, purity,"
                    " gross_weight, net_weight, certificate_id, gold_value, making_charges, other_component_value,"
                    " tax, total_price, status, created_at, updated_at, photo) VALUES (:id, :jid, :tok, :kind, :desc,"
                    " '22K', 10, 10, :cert, 1, 1, 0, 1, 3, 'active', '2026-10-01', '2026-10-01', :photo)"
                ),
                {"id": pk, "jid": f"JWL-26-AAAAA{pk}", "tok": f"TOKEN{pk:07d}", "kind": kind, "desc": desc,
                 "cert": cert, "photo": photo},
            )


def test_upgrade_moves_pieces_onto_a_placeholder_store(migrate):
    cfg, engine = migrate
    command.upgrade(cfg, BEFORE)
    seed_before(engine)
    command.upgrade(cfg, "head")

    with engine.connect() as c:
        store = c.execute(text("SELECT id, slug, name, city, area, phone, whatsapp FROM stores")).one()
        assert (store.slug, store.name, store.city, store.area) == (
            "old-name-jewellers", "Old Name Jewellers", "Mumbai", "Zaveri Bazaar")
        assert store.phone is None and store.whatsapp is None

        pieces = c.execute(text(
            "SELECT store_id, title, verification_level, stock_status, is_published FROM jewellery ORDER BY id"
        )).all()
        assert [(p.title, p.verification_level, p.stock_status, bool(p.is_published)) for p in pieces] == [
            ("Nakshi kada", "declared", "in_stock", True),
            ("Ring", "lab", "in_stock", True),
        ]
        assert {p.store_id for p in pieces} == {store.id}

        photo = c.execute(text("SELECT piece_id, position, alt_text, width, height, image, thumbnail FROM photos")).one()
        assert (photo.piece_id, photo.position, photo.alt_text, photo.width, photo.height) == (1, 0, "", 300, 400)
        assert photo.image.startswith(b"\xff\xd8\xff") and photo.thumbnail.startswith(b"\xff\xd8\xff")
        assert c.execute(text("SELECT count(*) FROM certificate_files")).scalar() == 0


def test_downgrade_restores_the_photo_and_store_name(migrate):
    cfg, engine = migrate
    command.upgrade(cfg, BEFORE)
    seed_before(engine)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, BEFORE)

    with engine.connect() as c:
        assert c.execute(text("SELECT store_name FROM store_settings")).scalar() == "Old Name Jewellers"
        name = c.execute(text("SELECT photo FROM jewellery WHERE id = 1")).scalar()
        assert name and c.execute(
            text("SELECT count(*) FROM certificate_files WHERE name = :n"), {"n": name}).scalar() == 1

    command.upgrade(cfg, "head")  # and back up cleanly
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_migrations.py -q`
Expected: FAIL; after `upgrade head` the query on `stores` raises `no such table: stores`.

- [ ] **Step 3: Add constants and models**

Append to `backend/app/constants.py`:

```python
# How far the store vouches for a piece. The badge buyers see always matches this.
VERIFICATION_LEVELS = ("declared", "hallmark", "lab")
STOCK_STATUSES = ("in_stock", "reserved", "sold")
DISCOUNT_TYPES = ("percent", "flat")
MAX_PHOTOS = 6
```

Replace `backend/app/models.py` with:

```python
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    status: Mapped[str] = mapped_column(String(20), default="active")
    # Embedded in every token; bumping it signs out all of this user's sessions.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Photo(Base):
    """An image of a store, piece or design, at two sizes. Bytes never change: replacing a photo
    means a new row, so its URL can be cached forever."""

    __tablename__ = "photos"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN store_id IS NULL THEN 0 ELSE 1 END)"
            " + (CASE WHEN piece_id IS NULL THEN 0 ELSE 1 END)"
            " + (CASE WHEN design_id IS NULL THEN 0 ELSE 1 END) = 1",
            name="ck_photos_one_owner",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    piece_id: Mapped[int | None] = mapped_column(ForeignKey("jewellery.id", ondelete="CASCADE"), index=True)
    design_id: Mapped[int | None] = mapped_column(ForeignKey("designs.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    alt_text: Mapped[str] = mapped_column(String(200), default="")  # blank: use the owner's title
    # Deferred so listing photos never loads the bytes.
    image: Mapped[bytes] = deferred(mapped_column(LargeBinary))
    thumbnail: Mapped[bytes] = deferred(mapped_column(LargeBinary))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Store(Base):
    """A shop on the marketplace. While it is inactive, buyers see none of its pieces or designs."""

    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)  # public key and future URL
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80), index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    phone: Mapped[str | None] = mapped_column(String(20))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    hours: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.store_id]
    )


class Jewellery(Base):
    __tablename__ = "jewellery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public, non-sequential identifiers. The internal `id` never leaves the backend.
    jewellery_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    verification_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(30), index=True)  # "category" in the UI
    description: Mapped[str] = mapped_column(Text)
    colour: Mapped[str | None] = mapped_column(String(30))
    design_details: Mapped[str | None] = mapped_column(Text)

    purity: Mapped[str] = mapped_column(String(10))
    gross_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    net_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))

    verification_level: Mapped[str] = mapped_column(String(20), default="declared")
    huid: Mapped[str | None] = mapped_column(String(6))  # BIS hallmark unique ID
    certificate_id: Mapped[str | None] = mapped_column(String(64), index=True)
    issuing_authority: Mapped[str | None] = mapped_column(String(160))
    certificate_date: Mapped[date | None] = mapped_column(Date)
    certificate_document: Mapped[str | None] = mapped_column(String(255))

    # The registered price: the fallback when no gold rate has ever been fetched.
    gold_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    making_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    other_component_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Making charges shown to buyers as a range, in % of the live gold value. Null: the fixed amount.
    making_percent_min: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    making_percent_max: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    discount_type: Mapped[str | None] = mapped_column(String(10))
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    # The discount applies up to the end of this day, Indian time.
    discount_ends_on: Mapped[date | None] = mapped_column(Date)

    stock_status: Mapped[str] = mapped_column(String(20), default="in_stock", index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    store: Mapped[Store] = relationship(lazy="joined")
    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.piece_id]
    )

    @property
    def is_active(self) -> bool:
        """Active itself and sold by an active store. Inactive pieces never verify."""
        return self.status == "active" and self.store.status == "active"


class Design(Base):
    """A piece the store can make to order. No QR code, verification level or discount."""

    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))
    purity_options: Mapped[str] = mapped_column(String(40))  # comma-separated, e.g. "22K,18K"
    weight_min: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    weight_max: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    price_min: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_max: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    making_days_min: Mapped[int] = mapped_column(Integer)
    making_days_max: Mapped[int] = mapped_column(Integer)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    store: Mapped[Store] = relationship(lazy="joined")
    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.design_id]
    )

    @property
    def purities(self) -> list[str]:
        return [p for p in self.purity_options.split(",") if p]

    @property
    def is_visible(self) -> bool:
        return self.is_published and self.store.status == "active"


class CertificateFile(Base):
    """Uploaded certificate documents. Kept in the database because serverless hosts have no lasting disk."""

    __tablename__ = "certificate_files"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)  # random hex + extension
    data: Mapped[bytes] = mapped_column(LargeBinary)


class StoreSettings(Base):
    """Marketplace-wide settings. Always a single row with id 1."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("3.00"), server_default="3.00")
    # Last time a gold rate fetch was attempted, successful or not. Stops a failing feed being retried
    # on every page view and burning the API quota.
    gold_rate_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GoldRate(Base):
    """One row per successful market fetch. The latest row is the current rate; the one before it
    gives the ticker its up/down movement."""

    __tablename__ = "gold_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inr_per_gram_24k: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # pure gold, per gram
    source: Mapped[str] = mapped_column(String(40))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
```

- [ ] **Step 4: Write the migration**

Create `backend/alembic/versions/0005_marketplace_foundation.py`:

```python
"""Stores, designs and photos; verification levels, stock, publishing and discounts on pieces

Revision ID: 0005_marketplace_foundation
Revises: 0004_store_and_live_pricing
Create Date: 2026-10-11
"""
import re
import secrets
import uuid
from datetime import datetime, timezone
from io import BytesIO

import sqlalchemy as sa
from alembic import op
from PIL import Image

revision = "0005_marketplace_foundation"
down_revision = "0004_store_and_live_pricing"
branch_labels = None
depends_on = None

# Existing pieces move onto one store with these details until the team edits them in admin.
PLACEHOLDER = {
    "address": "Placeholder address, Zaveri Bazaar, Mumbai",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": 18.9517,
    "longitude": 72.8331,
    "hours": "Placeholder: Mon-Sat 11 am - 8 pm",
}
ONE_OWNER = (
    "(CASE WHEN store_id IS NULL THEN 0 ELSE 1 END)"
    " + (CASE WHEN piece_id IS NULL THEN 0 ELSE 1 END)"
    " + (CASE WHEN design_id IS NULL THEN 0 ELSE 1 END) = 1"
)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "store"


def _jpeg(data: bytes, px: int) -> tuple[bytes, int, int]:
    """Same output as app.services.photos, inlined so the migration doesn't depend on app code."""
    img = Image.open(BytesIO(data)).convert("RGB")
    img.thumbnail((px, px), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    return buf.getvalue(), img.width, img.height


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("area", sa.String(80), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("whatsapp", sa.String(20), nullable=True),
        sa.Column("hours", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_stores_slug", "stores", ["slug"], unique=True)
    op.create_index("ix_stores_city", "stores", ["city"])

    op.create_table(
        "designs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(12), nullable=False),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("purity_options", sa.String(40), nullable=False),
        sa.Column("weight_min", sa.Numeric(10, 3), nullable=False),
        sa.Column("weight_max", sa.Numeric(10, 3), nullable=False),
        sa.Column("price_min", sa.Numeric(12, 2), nullable=False),
        sa.Column("price_max", sa.Numeric(12, 2), nullable=False),
        sa.Column("making_days_min", sa.Integer(), nullable=False),
        sa.Column("making_days_max", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_designs_public_id", "designs", ["public_id"], unique=True)
    op.create_index("ix_designs_store_id", "designs", ["store_id"])
    op.create_index("ix_designs_is_published", "designs", ["is_published"])

    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(32), nullable=False),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=True),
        sa.Column("piece_id", sa.Integer(), sa.ForeignKey("jewellery.id", ondelete="CASCADE"), nullable=True),
        sa.Column("design_id", sa.Integer(), sa.ForeignKey("designs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(200), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("thumbnail", sa.LargeBinary(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(ONE_OWNER, name="ck_photos_one_owner"),
    )
    op.create_index("ix_photos_public_id", "photos", ["public_id"], unique=True)
    op.create_index("ix_photos_store_id", "photos", ["store_id"])
    op.create_index("ix_photos_piece_id", "photos", ["piece_id"])
    op.create_index("ix_photos_design_id", "photos", ["design_id"])

    with op.batch_alter_table("jewellery") as batch:
        batch.add_column(sa.Column("store_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("title", sa.String(120), nullable=True))
        batch.add_column(sa.Column("verification_level", sa.String(20), nullable=False, server_default="declared"))
        batch.add_column(sa.Column("huid", sa.String(6), nullable=True))
        batch.add_column(sa.Column("stock_status", sa.String(20), nullable=False, server_default="in_stock"))
        batch.add_column(sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("discount_type", sa.String(10), nullable=True))
        batch.add_column(sa.Column("discount_value", sa.Numeric(12, 2), nullable=True))
        batch.add_column(sa.Column("discount_ends_on", sa.Date(), nullable=True))

    conn = op.get_bind()
    pieces = conn.execute(sa.text("SELECT id, type, description, certificate_id, photo FROM jewellery")).all()
    if pieces:
        now = datetime.now(timezone.utc)
        name = conn.execute(sa.text("SELECT store_name FROM store_settings WHERE id = 1")).scalar() or "Your Store Name"
        conn.execute(
            sa.text(
                "INSERT INTO stores (slug, name, address, area, city, latitude, longitude, hours, status,"
                " created_at, updated_at) VALUES (:slug, :name, :address, :area, :city, :latitude, :longitude,"
                " :hours, 'active', :now, :now)"
            ),
            {"slug": _slug(name), "name": name, "now": now, **PLACEHOLDER},
        )
        store_id = conn.execute(sa.text("SELECT id FROM stores")).scalar_one()
        for piece in pieces:
            # "Nakshi kada in 22K gold" -> "Nakshi kada"; without " in ", the category.
            title = piece.description.split(" in ")[0].strip() if " in " in piece.description else piece.type
            conn.execute(
                sa.text(
                    "UPDATE jewellery SET store_id = :store, title = :title, verification_level = :level,"
                    " is_published = :published WHERE id = :id"
                ),
                # Every existing piece stays published, so no printed QR code starts saying "not found".
                {"store": store_id, "title": title[:120], "level": "lab" if piece.certificate_id else "declared",
                 "published": True, "id": piece.id},
            )
            if piece.photo:
                data = conn.execute(
                    sa.text("SELECT data FROM certificate_files WHERE name = :n"), {"n": piece.photo}
                ).scalar()
                if data:
                    image, width, height = _jpeg(data, 1600)
                    thumbnail, _, _ = _jpeg(data, 600)
                    conn.execute(
                        sa.text(
                            "INSERT INTO photos (public_id, piece_id, position, alt_text, image, thumbnail, width,"
                            " height, created_at) VALUES (:pid, :piece, 0, '', :image, :thumbnail, :width, :height,"
                            " :now)"
                        ),
                        {"pid": secrets.token_hex(16), "piece": piece.id, "image": image, "thumbnail": thumbnail,
                         "width": width, "height": height, "now": now},
                    )
                    conn.execute(sa.text("DELETE FROM certificate_files WHERE name = :n"), {"n": piece.photo})

    with op.batch_alter_table("jewellery") as batch:
        batch.alter_column("store_id", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("title", existing_type=sa.String(120), nullable=False)
        batch.create_foreign_key("fk_jewellery_store_id", "stores", ["store_id"], ["id"])
        batch.create_index("ix_jewellery_store_id", ["store_id"])
        batch.create_index("ix_jewellery_stock_status", ["stock_status"])
        batch.create_index("ix_jewellery_is_published", ["is_published"])
        batch.drop_column("photo")

    with op.batch_alter_table("store_settings") as batch:
        batch.drop_column("store_name")


def downgrade() -> None:
    with op.batch_alter_table("store_settings") as batch:
        batch.add_column(sa.Column("store_name", sa.String(120), nullable=False, server_default=""))
    with op.batch_alter_table("jewellery") as batch:
        batch.add_column(sa.Column("photo", sa.String(255), nullable=True))

    conn = op.get_bind()
    name = conn.execute(sa.text("SELECT name FROM stores ORDER BY id LIMIT 1")).scalar()
    if name:
        conn.execute(sa.text("UPDATE store_settings SET store_name = :n WHERE id = 1"), {"n": name})
    first_photos = conn.execute(
        sa.text("SELECT piece_id, image FROM photos WHERE piece_id IS NOT NULL AND position = 0")
    ).all()
    for row in first_photos:
        stored = f"{uuid.uuid4().hex}.jpg"
        conn.execute(sa.text("INSERT INTO certificate_files (name, data) VALUES (:n, :d)"), {"n": stored, "d": row.image})
        conn.execute(sa.text("UPDATE jewellery SET photo = :n WHERE id = :id"), {"n": stored, "id": row.piece_id})

    with op.batch_alter_table("jewellery") as batch:
        batch.drop_index("ix_jewellery_is_published")
        batch.drop_index("ix_jewellery_stock_status")
        batch.drop_index("ix_jewellery_store_id")
        batch.drop_constraint("fk_jewellery_store_id", type_="foreignkey")
        for column in ("discount_ends_on", "discount_value", "discount_type", "is_published", "stock_status",
                       "huid", "verification_level", "title", "store_id"):
            batch.drop_column(column)

    op.drop_table("photos")
    op.drop_table("designs")
    op.drop_table("stores")
```

- [ ] **Step 5: Run the migration tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_migrations.py -q`
Expected: PASS (2 tests). The API tests still fail at this point because the routers use the old model; Steps 6-10 fix that.

- [ ] **Step 6: Add `field_error`, rename the settings helper, add `photo_out`**

Create `backend/app/errors.py`:

```python
from fastapi.exceptions import RequestValidationError


def field_error(field: str, message: str) -> RequestValidationError:
    """A 422 in the same {detail, fields} shape as request validation, for rules that need the database."""
    return RequestValidationError([{"type": "value_error", "loc": ("body", field), "msg": message, "input": None}])
```

Rename `get_store` to `get_store_settings`, because "store" now means a shop. In `backend/app/services/store.py`, rename the function and set its docstring to `"""The single marketplace settings row, created on first use."""`, keeping its body. Then update every caller:

Run: `cd backend && grep -rl "get_store\b" app seed.py | xargs sed -i 's/\bget_store\b/get_store_settings/g' && grep -rn "get_store" app seed.py`
Expected: only `get_store_settings` (in `services/store.py`, `services/gold_rate.py`, `services/pricing.py`, `routers/settings.py`, `routers/verify.py`, `seed.py`).

In `backend/app/services/photos.py`, add after the PIL import:

```python
from app.models import Photo
from app.schemas import PhotoOut
```

and append:

```python
def photo_out(photo: Photo, title: str) -> PhotoOut:
    """`alt` is what screen readers get: the entered alt text, or the owner's title."""
    return PhotoOut(
        public_id=photo.public_id,
        alt_text=photo.alt_text,
        alt=photo.alt_text or title,
        width=photo.width,
        height=photo.height,
        position=photo.position,
    )
```

In `backend/app/services/files.py`, delete `PHOTO_TYPES` and `save_photo`; photos now go through `services/photos.py`. Nothing else in `files.py` changes.

- [ ] **Step 7: Reshape the schemas**

In `backend/app/schemas.py`:

1. Change the imports to:

```python
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from app.constants import (
    DISCOUNT_TYPES,
    GOLD_COLOURS,
    JEWELLERY_TYPES,
    PURITY_PERCENT,
    STOCK_STATUSES,
    VERIFICATION_LEVELS,
)
```

2. Replace the alias block (from `JewelleryType = ...` to `Percent = ...`, plus the `DiscountType` line added in Task 1) with:

```python
JewelleryType = Literal[JEWELLERY_TYPES]  # type: ignore[valid-type]
Purity = Literal[tuple(PURITY_PERCENT)]  # type: ignore[valid-type]
GoldColour = Literal[GOLD_COLOURS]  # type: ignore[valid-type]
VerificationLevel = Literal[VERIFICATION_LEVELS]  # type: ignore[valid-type]
StockStatus = Literal[STOCK_STATUSES]  # type: ignore[valid-type]
DiscountType = Literal[DISCOUNT_TYPES]  # type: ignore[valid-type]
RecordStatus = Literal["active", "inactive"]

Weight = Annotated[Decimal, Field(gt=0, le=100000, max_digits=10, decimal_places=3)]
Money = Annotated[Decimal, Field(ge=0, le=999999999, max_digits=12, decimal_places=2)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
Slug = Annotated[str, Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
```

3. Insert above `# ---------- Jewellery ----------`:

```python
# ---------- Shared ----------

class StoreRef(BaseModel):
    """Which store a piece or design belongs to, as buyers see it."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    area: str
    city: str


class PhotoOut(BaseModel):
    public_id: str
    alt_text: str  # as entered; blank means "use the title"
    alt: str  # what screen readers get
    width: int
    height: int
    position: int
```

4. Replace `class JewelleryIn` (keep `JewelleryUpdate` unchanged) with:

```python
class JewelleryIn(BaseModel):
    store: Slug
    title: str = Field(min_length=2, max_length=120)
    type: JewelleryType
    description: str = Field(min_length=3, max_length=500)
    colour: GoldColour | None = None
    design_details: str | None = Field(default=None, max_length=1000)

    purity: Purity
    gross_weight: Weight
    net_weight: Weight

    certificate_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9\-/._]*$")
    issuing_authority: str | None = Field(default=None, max_length=160)
    certificate_date: date | None = None
    # Declared after the certificate fields so its validator can see them.
    verification_level: VerificationLevel = Field(default="declared", validate_default=True)
    huid: str | None = Field(default=None, validate_default=True)

    gold_value: Money
    making_charges: Money
    other_component_value: Money = Decimal("0")
    tax: Money
    # Optional manual correction. When omitted the total is calculated from the components.
    total_price: Money | None = None
    # Making charges range shown to buyers, in % of the live gold value. Both or neither.
    making_percent_min: Percent | None = None
    making_percent_max: Percent | None = None

    stock_status: StockStatus = "in_stock"
    is_published: bool = False
    # Declared after the prices so a flat discount can be checked against the registered total.
    discount_type: DiscountType | None = None
    discount_value: Money | None = Field(default=None, validate_default=True)
    discount_ends_on: date | None = None

    @field_validator("description", "design_details", "certificate_id", "issuing_authority", "huid", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("store", "title", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("verification_level")
    @classmethod
    def lab_needs_certificate(cls, level: str, info: ValidationInfo) -> str:
        needed = ("certificate_id", "issuing_authority", "certificate_date")
        if level == "lab" and not all(info.data.get(k) for k in needed):
            raise ValueError("Lab verified needs the certificate ID, issuing authority and date")
        return level

    @field_validator("huid")
    @classmethod
    def huid_for_hallmark(cls, huid: str | None, info: ValidationInfo) -> str | None:
        if huid is not None and not re.fullmatch(r"[A-Za-z0-9]{6}", huid):
            raise ValueError("A HUID is 6 letters or digits")
        if huid is None and info.data.get("verification_level") == "hallmark":
            raise ValueError("Enter the piece's 6-character HUID")
        return huid.upper() if huid else None

    @field_validator("discount_value")
    @classmethod
    def discount_rules(cls, value: Decimal | None, info: ValidationInfo) -> Decimal | None:
        kind = info.data.get("discount_type")
        if kind is None:
            if value is not None:
                raise ValueError("Choose whether the discount is a percent or a flat amount")
            return None
        if value is None:
            raise ValueError("Enter the discount")
        if kind == "percent" and not Decimal(1) <= value <= Decimal(90):
            raise ValueError("A percent discount must be between 1 and 90")
        if kind == "flat":
            parts = ("gold_value", "making_charges", "other_component_value", "tax")
            total = info.data.get("total_price") or sum((info.data.get(k) or Decimal(0)) for k in parts)
            if not Decimal(0) < value < total:
                raise ValueError("A flat discount must be above ₹0 and below the registered price")
        return value

    @model_validator(mode="after")
    def check_consistency(self):
        if self.net_weight > self.gross_weight:
            raise ValueError("Net gold weight cannot exceed gross weight")
        if self.certificate_date and self.certificate_date > date.today():
            raise ValueError("Certificate date cannot be in the future")
        if (self.issuing_authority or self.certificate_date) and not self.certificate_id:
            raise ValueError("Certificate ID is required when certificate details are provided")
        if (self.making_percent_min is None) != (self.making_percent_max is None):
            raise ValueError("Enter both ends of the making charges range, or neither")
        if self.making_percent_min is not None and self.making_percent_min > self.making_percent_max:
            raise ValueError("Making charges range: the minimum can't be above the maximum")
        return self

    @property
    def calculated_total(self) -> Decimal:
        return self.gold_value + self.making_charges + self.other_component_value + self.tax
```

5. Replace `class JewelleryOut` and `class JewelleryStats` with the following, and add `PricePreviewIn` after them:

```python
class JewelleryOut(BaseModel):
    """Admin view. Deliberately excludes the internal database ids."""

    model_config = ConfigDict(from_attributes=True)

    jewellery_id: str
    verification_token: str
    verification_url: str
    store: StoreRef
    title: str
    type: str
    description: str
    colour: str | None
    design_details: str | None
    photos: list[PhotoOut]
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    verification_level: str
    huid: str | None
    certificate_id: str | None
    issuing_authority: str | None
    certificate_date: date | None
    has_certificate_document: bool
    gold_value: Decimal
    making_charges: Decimal
    other_component_value: Decimal
    tax: Decimal
    total_price: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    discount_type: str | None
    discount_value: Decimal | None
    discount_ends_on: date | None
    stock_status: str
    is_published: bool
    price: "PiecePrice"  # what buyers see right now
    status: str
    created_at: datetime
    updated_at: datetime


class JewelleryStats(BaseModel):
    total: int
    published: int  # active and published
    in_stock: int  # active, published and in stock
    inactive: int
    stores: int
    designs: int


class PricePreviewIn(BaseModel):
    """The figures the admin form has so far, to preview the price buyers would see."""

    purity: Purity
    net_weight: Weight
    gold_value: Money
    making_charges: Money
    other_component_value: Money = Decimal("0")
    tax: Money
    making_percent_min: Percent | None = None
    making_percent_max: Percent | None = None
    discount_type: DiscountType | None = None
    discount_value: Money | None = None
    discount_ends_on: date | None = None
    stock_status: StockStatus = "in_stock"
```

6. Replace `class StoreSettingsIn` and `class StoreSettingsOut` with:

```python
class StoreSettingsIn(BaseModel):
    gst_percent: Percent


class StoreSettingsOut(StoreSettingsIn):
    gold_feed_configured: bool
    gold_rate_ttl_minutes: int
    gold_rate: GoldRateOut | None
```

7. Delete `class LivePrice` and replace `class PublicVerification` with:

```python
class PublicVerification(BaseModel):
    """Everything a buyer sees. No internal ids, no document paths, no admin data."""

    jewellery_id: str
    title: str
    store: StoreRef
    type: str
    description: str
    colour: str | None
    design_details: str | None
    photos: list[PhotoOut]
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    verification_level: VerificationLevel
    # Only what the level vouches for: the HUID from Hallmark linked up, the certificate for Lab verified.
    huid: str | None
    certificate_id: str | None
    issuing_authority: str | None
    certificate_date: date | None
    stock_status: StockStatus
    record_status: Literal["ACTIVE"]
    registered_on: date
    gold_rate: GoldRateOut | None
    price: PiecePrice
```

8. At the very end of the file add `JewelleryOut.model_rebuild()` so the forward reference to `PiecePrice` resolves.

In `backend/app/services/pricing.py`, delete the `live_price` function and remove `LivePrice` and `Jewellery` from its imports.

- [ ] **Step 8: Update the jewellery router**

Replace `backend/app/routers/jewellery.py` with:

```python
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import PURITY_PERCENT
from app.database import get_db
from app.deps import require_admin
from app.errors import field_error
from app.models import Design, Jewellery, Store
from app.schemas import (
    JewelleryIn,
    JewelleryOut,
    JewelleryPage,
    JewelleryStats,
    JewelleryType,
    JewelleryUpdate,
    PiecePrice,
    PricePreviewIn,
    Purity,
    RecordStatus,
    StockStatus,
    StoreRef,
)
from app.services import files
from app.services.identifiers import new_jewellery_id, new_verification_token
from app.services.photos import photo_out
from app.services.pricing import PricingContext, piece_price, pricing_context
from app.services.qr import render_qr_png

router = APIRouter(prefix="/api/jewellery", tags=["jewellery"], dependencies=[Depends(require_admin)])

SORTABLE = {
    "created_at": Jewellery.created_at,
    "jewellery_id": Jewellery.jewellery_id,
    "type": Jewellery.type,
    "net_weight": Jewellery.net_weight,
    "total_price": Jewellery.total_price,
}
SortField = Literal["created_at", "jewellery_id", "type", "net_weight", "total_price"]


def to_out(item: Jewellery, ctx: PricingContext) -> JewelleryOut:
    return JewelleryOut.model_validate(
        {
            **{c.key: getattr(item, c.key) for c in Jewellery.__table__.columns},
            "store": StoreRef.model_validate(item.store),
            "photos": [photo_out(p, item.title) for p in item.photos],
            "verification_url": get_settings().verification_url(item.verification_token),
            "purity_percent": PURITY_PERCENT.get(item.purity, ""),
            "has_certificate_document": bool(item.certificate_document),
            "price": piece_price(item, ctx.rate, ctx.gst_percent, ctx.today),
        }
    )


def get_or_404(db: Session, jewellery_id: str) -> Jewellery:
    item = db.scalar(select(Jewellery).where(Jewellery.jewellery_id == jewellery_id.upper()))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jewellery record not found")
    return item


def check_rules(item: Jewellery) -> None:
    """Rules that depend on what's already stored: the certificate file and the photos."""
    if item.verification_level == "lab" and not item.certificate_document:
        raise field_error(
            "verification_level",
            "Upload the certificate file first: save the piece, attach the file, then choose Lab verified",
        )
    if item.is_published and not item.photos:
        raise field_error("is_published", "Add at least one photo before publishing")


def apply_fields(db: Session, item: Jewellery, body: JewelleryIn) -> None:
    store = db.scalar(select(Store).where(Store.slug == body.store))
    if store is None:
        raise field_error("store", "Choose one of the stores")
    for key, value in body.model_dump(exclude={"store", "total_price", "status"}).items():
        setattr(item, key, value)
    item.store = store
    item.total_price = body.total_price if body.total_price is not None else body.calculated_total
    check_rules(item)


@router.get("", response_model=JewelleryPage)
def list_jewellery(
    db: Session = Depends(get_db),
    search: str | None = Query(None, max_length=64),
    type: JewelleryType | None = None,
    purity: Purity | None = None,
    status_: RecordStatus | None = Query(None, alias="status"),
    store: str | None = Query(None, max_length=80),
    published: bool | None = None,
    stock: StockStatus | None = None,
    sort: SortField = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> JewelleryPage:
    query = select(Jewellery)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Jewellery.jewellery_id).like(term),
                func.lower(Jewellery.certificate_id).like(term),
                func.lower(Jewellery.type).like(term),
                func.lower(Jewellery.title).like(term),
                func.lower(Jewellery.description).like(term),
            )
        )
    if type:
        query = query.where(Jewellery.type == type)
    if purity:
        query = query.where(Jewellery.purity == purity)
    if status_:
        query = query.where(Jewellery.status == status_)
    if store:
        query = query.where(Jewellery.store_id == select(Store.id).where(Store.slug == store).scalar_subquery())
    if published is not None:
        query = query.where(Jewellery.is_published == published)
    if stock:
        query = query.where(Jewellery.stock_status == stock)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    column = SORTABLE[sort]
    query = query.order_by(column.asc() if order == "asc" else column.desc(), Jewellery.id.desc())
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    ctx = pricing_context(db)
    return JewelleryPage(items=[to_out(i, ctx) for i in items], total=total, page=page, page_size=page_size)


@router.get("/stats", response_model=JewelleryStats)
def stats(db: Session = Depends(get_db)) -> JewelleryStats:
    def count(*conditions) -> int:
        return db.scalar(select(func.count(Jewellery.id)).where(*conditions)) or 0

    live = (Jewellery.status == "active", Jewellery.is_published == True)  # noqa: E712 (SQL expression)
    return JewelleryStats(
        total=count(),
        published=count(*live),
        in_stock=count(*live, Jewellery.stock_status == "in_stock"),
        inactive=count(Jewellery.status == "inactive"),
        stores=db.scalar(select(func.count(Store.id))) or 0,
        designs=db.scalar(select(func.count(Design.id))) or 0,
    )


@router.post("/price-preview", response_model=PiecePrice)
def price_preview(body: PricePreviewIn, db: Session = Depends(get_db)) -> PiecePrice:
    """The price buyers would see for these figures, so the admin form can preview a discount."""
    ctx = pricing_context(db)
    piece = SimpleNamespace(**body.model_dump(), updated_at=datetime.now(timezone.utc))
    return piece_price(piece, ctx.rate, ctx.gst_percent, ctx.today)


@router.post("", response_model=JewelleryOut, status_code=status.HTTP_201_CREATED)
def create_jewellery(body: JewelleryIn, db: Session = Depends(get_db)) -> JewelleryOut:
    item = Jewellery(
        jewellery_id=new_jewellery_id(db),
        verification_token=new_verification_token(db),
        status="active",
    )
    apply_fields(db, item, body)
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))


@router.get("/{jewellery_id}", response_model=JewelleryOut)
def get_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    return to_out(get_or_404(db, jewellery_id), pricing_context(db))


@router.put("/{jewellery_id}", response_model=JewelleryOut)
def update_jewellery(jewellery_id: str, body: JewelleryUpdate, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    apply_fields(db, item, body)
    if body.status:
        item.status = body.status
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))


@router.delete("/{jewellery_id}", response_model=JewelleryOut)
def deactivate_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    """Soft delete: the record is kept, but its QR code no longer verifies."""
    item = get_or_404(db, jewellery_id)
    item.status = "inactive"
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))


@router.post("/{jewellery_id}/activate", response_model=JewelleryOut)
def activate_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    item.status = "active"
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))


@router.get("/{jewellery_id}/qr", response_class=Response, responses={200: {"content": {"image/png": {}}}})
def jewellery_qr(jewellery_id: str, caption: bool = True, db: Session = Depends(get_db)) -> Response:
    item = get_or_404(db, jewellery_id)
    png = render_qr_png(
        get_settings().verification_url(item.verification_token),
        caption=item.jewellery_id if caption else None,
    )
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{item.jewellery_id}-qr.png"'},
    )


@router.post("/{jewellery_id}/certificate", response_model=JewelleryOut)
async def upload_certificate(
    jewellery_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)
) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    previous = item.certificate_document
    item.certificate_document = await files.save_certificate(db, file)
    files.delete_file(db, previous)
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))


@router.get("/{jewellery_id}/certificate")
def download_certificate(jewellery_id: str, db: Session = Depends(get_db)) -> Response:
    item = get_or_404(db, jewellery_id)
    if not item.certificate_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No certificate document uploaded")
    suffix = Path(item.certificate_document).suffix
    return Response(
        content=files.load_file(db, item.certificate_document),
        media_type=files.MEDIA_TYPES[suffix],
        headers={"Content-Disposition": f'attachment; filename="{item.jewellery_id}-certificate{suffix}"'},
    )


@router.delete("/{jewellery_id}/certificate", response_model=JewelleryOut)
def remove_certificate(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    if item.verification_level == "lab":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This piece is Lab verified. Change its verification level before removing the certificate file",
        )
    files.delete_file(db, item.certificate_document)
    item.certificate_document = None
    db.commit()
    db.refresh(item)
    return to_out(item, pricing_context(db))
```

- [ ] **Step 9: Update the verify and settings routers**

Replace `backend/app/routers/verify.py` with:

```python
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.database import get_db
from app.models import Jewellery
from app.schemas import PublicVerification, StoreRef
from app.services.photos import photo_out
from app.services.pricing import gold_rate_out, piece_price, pricing_context

router = APIRouter(prefix="/api/verify", tags=["public verification"])

Code = Path(min_length=4, max_length=32, pattern=r"^[A-Za-z0-9\-]+$")


def visible_piece(db: Session, token: str) -> Jewellery:
    """Accepts the QR token, or the Jewellery ID printed under the QR for buyers who enter it by hand.
    Unpublished pieces are reported as not found, so a draft can't be discovered."""
    code = token.strip().upper()
    item = db.scalar(
        select(Jewellery).where(or_(Jewellery.verification_token == code, Jewellery.jewellery_id == code))
    )
    if item is None or not item.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
    if not item.is_active:
        # No jewellery details are returned for inactive records.
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Record inactive")
    return item


@router.get(
    "/{token}",
    response_model=PublicVerification,
    responses={404: {"description": "No such record"}, 410: {"description": "Record inactive"}},
)
def verify(token: str = Code, db: Session = Depends(get_db)) -> PublicVerification:
    """Public endpoint opened from the QR code."""
    item = visible_piece(db, token)
    ctx = pricing_context(db)
    lab = item.verification_level == "lab"

    return PublicVerification(
        jewellery_id=item.jewellery_id,
        title=item.title,
        store=StoreRef.model_validate(item.store),
        type=item.type,
        description=item.description,
        colour=item.colour,
        design_details=item.design_details,
        photos=[photo_out(p, item.title) for p in item.photos],
        purity=item.purity,
        purity_percent=PURITY_PERCENT.get(item.purity, ""),
        gross_weight=item.gross_weight,
        net_weight=item.net_weight,
        verification_level=item.verification_level,
        huid=item.huid if item.verification_level != "declared" else None,
        certificate_id=item.certificate_id if lab else None,
        issuing_authority=item.issuing_authority if lab else None,
        certificate_date=item.certificate_date if lab else None,
        stock_status=item.stock_status,
        record_status="ACTIVE",
        registered_on=item.created_at.date(),
        gold_rate=gold_rate_out(ctx.rate) if ctx.rate else None,
        price=piece_price(item, ctx.rate, ctx.gst_percent, ctx.today),
    )
```

Replace `backend/app/routers/settings.py` with:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import require_admin
from app.schemas import StoreSettingsIn, StoreSettingsOut
from app.services.gold_rate import configured_feed, current_rate
from app.services.pricing import gold_rate_out
from app.services.store import get_store_settings

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)])


def to_out(db: Session) -> StoreSettingsOut:
    settings = get_settings()
    rate = current_rate(db)
    return StoreSettingsOut(
        gst_percent=get_store_settings(db).gst_percent,
        gold_feed_configured=configured_feed(settings) is not None,
        gold_rate_ttl_minutes=settings.gold_rate_ttl_minutes,
        gold_rate=gold_rate_out(rate) if rate else None,
    )


@router.get("", response_model=StoreSettingsOut)
def read_settings(db: Session = Depends(get_db)) -> StoreSettingsOut:
    return to_out(db)


@router.put("", response_model=StoreSettingsOut)
def update_settings(body: StoreSettingsIn, db: Session = Depends(get_db)) -> StoreSettingsOut:
    get_store_settings(db).gst_percent = body.gst_percent
    db.commit()
    return to_out(db)
```

`seed.py` is rewritten in Task 7; until then it only gets the rename from Step 6 (neither the app nor the tests import it).

- [ ] **Step 10: Update the test fixtures and API tests**

Replace `backend/tests/conftest.py` with:

```python
import os

# Configure before the app is imported: isolated DB, fixed secret.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["PUBLIC_BASE_URL"] = "https://verify.example.com"
os.environ["GOLDAPI_KEY"] = ""  # tests that need a rate enable it explicitly
os.environ["METALS_DEV_API_KEY"] = ""

import secrets
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Jewellery, Photo, Store, User
from app.security import hash_password

ADMIN_EMAIL = "admin@test.demo"
ADMIN_PASSWORD = "Secret@123"
TEST_STORE = "test-store"


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with TestSession() as db:
        db.add(User(name="Admin", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role="admin"))
        db.add(Store(
            slug=TEST_STORE, name="Test Jewellers", address="1 Test Road", area="Test Area", city="Mumbai",
            latitude=Decimal("18.95"), longitude=Decimal("72.83"), hours="Daily 10 am - 8 pm", status="active",
        ))
        db.commit()

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def db(client):
    """A session on the test database, for arranging state the API can't set directly."""
    session = next(app.dependency_overrides[get_db]())
    yield session
    session.close()


@pytest.fixture()
def auth(client):
    res = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def payload():
    return {
        "store": TEST_STORE,
        "title": "Diamond ring",
        "type": "Ring",
        "description": "22K gold diamond ring",
        "purity": "22K",
        "gross_weight": "16.02",
        "net_weight": "15.42",
        "certificate_id": "DEMO-HM-1",
        "issuing_authority": "Test Assay Centre",
        "certificate_date": "2026-01-10",
        "gold_value": "98500",
        "making_charges": "12000",
        "other_component_value": "4000",
        "tax": "10500",
    }


@pytest.fixture()
def add_photo(db):
    """Attach a placeholder photo row to a piece without going through the upload API."""
    def add(jewellery_id: str) -> None:
        piece = db.scalar(select(Jewellery).where(Jewellery.jewellery_id == jewellery_id))
        db.add(Photo(public_id=secrets.token_hex(16), piece_id=piece.id, position=len(piece.photos), alt_text="",
                     image=b"image", thumbnail=b"thumb", width=4, height=3))
        db.commit()
        db.expire_all()
    return add


@pytest.fixture()
def publish(client, auth, payload, add_photo):
    """Create a piece with a photo and publish it. Returns the admin record."""
    def make(**overrides) -> dict:
        body = {**payload, **overrides}
        created = client.post("/api/jewellery", json=body, headers=auth)
        assert created.status_code == 201, created.text
        jid = created.json()["jewellery_id"]
        add_photo(jid)
        res = client.put(f"/api/jewellery/{jid}", json={**body, "is_published": True}, headers=auth)
        assert res.status_code == 200, res.text
        return res.json()
    return make
```

In `backend/tests/test_api.py`:

a) Add to the imports:

```python
from sqlalchemy import select

from app.models import Store
```

b) In `test_create_calculates_total_and_ids`, replace `assert body["verification_status"] == "VERIFIED"` with:

```python
    assert body["verification_level"] == "declared"
    assert body["store"] == {"slug": "test-store", "name": "Test Jewellers", "area": "Test Area", "city": "Mumbai"}
    assert body["title"] == "Diamond ring" and body["photos"] == [] and body["is_published"] is False
    assert body["price"]["basis"] == "registered" and Decimal(body["price"]["final_max"]) == 125000
```

c) Delete `test_registered_without_certificate` and `test_photo_upload_flow`.

d) In `test_deactivate_and_stats`, replace the stats assertion with:

```python
    assert client.get("/api/jewellery/stats", headers=auth).json() == {
        "total": 2, "published": 0, "in_stock": 0, "inactive": 1, "stores": 1, "designs": 0,
    }
```

e) Replace `test_public_verify_valid` and `test_public_verify_inactive_hides_details` with:

```python
def test_public_verify_valid(client, publish):
    created = publish()
    res = client.get(f"/api/verify/{created['verification_token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["jewellery_id"] == created["jewellery_id"]
    assert body["verification_level"] == "declared"
    assert body["record_status"] == "ACTIVE"
    for private in ("verification_token", "certificate_document", "id", "status", "updated_at", "store_id",
                    "is_published"):
        assert private not in body

    # The printed Jewellery ID also works for manual entry, case-insensitively.
    assert client.get(f"/api/verify/{created['jewellery_id'].lower()}").status_code == 200


def test_public_verify_inactive_hides_details(client, auth, publish):
    created = publish()
    client.delete(f"/api/jewellery/{created['jewellery_id']}", headers=auth)
    res = client.get(f"/api/verify/{created['verification_token']}")
    assert res.status_code == 410
    assert res.json() == {"detail": "Record inactive"}
```

f) In `test_design_fields_and_making_range_validation`, add `publish` to its parameters and replace its first two lines (`body = ...` and `created = client.post(...)`) with:

```python
    created = publish(colour="Rose gold", design_details="Floral filigree", making_percent_min="10",
                      making_percent_max="14")
```

g) Replace `test_store_settings` with:

```python
def test_store_settings(client, auth):
    assert client.get("/api/settings").status_code == 401
    res = client.get("/api/settings", headers=auth).json()
    assert Decimal(res["gst_percent"]) == 3 and "store_name" not in res
    assert res["gold_feed_configured"] is False and res["gold_rate"] is None

    res = client.put("/api/settings", json={"gst_percent": "5"}, headers=auth)
    assert res.status_code == 200 and Decimal(res.json()["gst_percent"]) == 5
```

h) In `test_live_price_from_market_rate`, change its parameters to `(client, publish, monkeypatch)`, keep the `calls`/`fake_fetch`/monkeypatch lines, and replace everything from `body = {**payload, ...` to the end with:

```python
    created = publish(net_weight="10", other_component_value="1000", making_percent_min="10", making_percent_max="15")
    token = created["verification_token"]

    res = client.get(f"/api/verify/{token}").json()
    rate, price = res["gold_rate"], res["price"]
    assert Decimal(rate["per_gram"]["22K"]) == Decimal("9160")
    assert rate["change_percent"] is None
    assert price["basis"] == "live"
    # 10 g x 9,160 = 91,600; making 10-15% = 9,160-13,740; GST 3% on gold + making + stones.
    assert Decimal(price["gold"]) == 91600
    assert (Decimal(price["making_min"]), Decimal(price["making_max"])) == (9160, 13740)
    assert (Decimal(price["tax_min"]), Decimal(price["tax_max"])) == (3053, 3190)
    assert (Decimal(price["final_min"]), Decimal(price["final_max"])) == (104813, 109530)

    # Within the cache window the API isn't called again.
    client.get(f"/api/verify/{token}")
    assert calls == [("goldapi", "test-key")]
```

i) In `test_gold_rate_falls_back_to_last_known`, change its parameters to `(client, publish, monkeypatch)` and replace `token = client.post("/api/jewellery", json=payload, headers=auth).json()["verification_token"]` with `token = publish()["verification_token"]`.

j) Append:

```python
# ---------- Pieces on the marketplace model ----------

def test_piece_needs_a_known_store(client, auth, payload):
    res = client.post("/api/jewellery", json={**payload, "store": "no-such-store"}, headers=auth)
    assert res.status_code == 422 and "store" in res.json()["fields"]


def test_verification_level_rules(client, auth, payload):
    res = client.post("/api/jewellery", json={**payload, "verification_level": "hallmark"}, headers=auth)
    assert res.status_code == 422 and "huid" in res.json()["fields"]
    res = client.post("/api/jewellery", json={**payload, "verification_level": "hallmark", "huid": "ab12cd"},
                      headers=auth)
    assert res.status_code == 201 and res.json()["huid"] == "AB12CD"
    jid = res.json()["jewellery_id"]

    lab = {**payload, "verification_level": "lab"}
    res = client.put(f"/api/jewellery/{jid}", json=lab, headers=auth)
    assert res.status_code == 422 and "verification_level" in res.json()["fields"]  # no certificate file yet
    res = client.put(f"/api/jewellery/{jid}", json={**lab, "issuing_authority": None}, headers=auth)
    assert res.status_code == 422 and "verification_level" in res.json()["fields"]

    client.post(f"/api/jewellery/{jid}/certificate", files={"file": ("c.png", PNG_1PX, "image/png")}, headers=auth)
    assert client.put(f"/api/jewellery/{jid}", json=lab, headers=auth).json()["verification_level"] == "lab"
    assert client.delete(f"/api/jewellery/{jid}/certificate", headers=auth).status_code == 422


def test_publishing_needs_a_photo(client, auth, payload, add_photo):
    res = client.post("/api/jewellery", json={**payload, "is_published": True}, headers=auth)
    assert res.status_code == 422 and "is_published" in res.json()["fields"]

    jid = client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]
    add_photo(jid)
    res = client.put(f"/api/jewellery/{jid}", json={**payload, "is_published": True}, headers=auth)
    assert res.status_code == 200 and res.json()["is_published"] is True


@pytest.mark.parametrize("discount, field", [
    ({"discount_type": "percent", "discount_value": "0.5"}, "discount_value"),
    ({"discount_type": "percent", "discount_value": "95"}, "discount_value"),
    ({"discount_type": "flat", "discount_value": "125000"}, "discount_value"),
    ({"discount_type": "flat"}, "discount_value"),
    ({"discount_value": "10"}, "discount_value"),
    ({"discount_type": "half"}, "discount_type"),
])
def test_discount_validation(client, auth, payload, discount, field):
    res = client.post("/api/jewellery", json={**payload, **discount}, headers=auth)
    assert res.status_code == 422 and field in res.json()["fields"], res.text


def test_discount_shows_in_the_price(client, auth, payload):
    body = {**payload, "discount_type": "flat", "discount_value": "5000", "discount_ends_on": "2020-01-01"}
    res = client.post("/api/jewellery", json=body, headers=auth)
    assert res.status_code == 201  # a past end date is allowed; the discount just isn't shown
    assert res.json()["price"]["discount"] is None

    res = client.put(f"/api/jewellery/{res.json()['jewellery_id']}", json={**body, "discount_ends_on": None},
                     headers=auth)
    price = res.json()["price"]
    assert price["discount"]["label"] == "₹5,000 off"
    assert Decimal(price["original_max"]) == 125000 and Decimal(price["final_max"]) == 120000


def test_price_preview(client, auth, payload):
    figures = {k: payload[k] for k in ("purity", "net_weight", "gold_value", "making_charges",
                                       "other_component_value", "tax")}
    res = client.post("/api/jewellery/price-preview",
                      json={**figures, "discount_type": "percent", "discount_value": "10"}, headers=auth)
    assert res.status_code == 200
    assert Decimal(res.json()["final_max"]) == 112500 and res.json()["discount"]["label"] == "10% off"
    assert client.post("/api/jewellery/price-preview", json=figures).status_code == 401


def test_list_filters(client, auth, payload, publish):
    publish()
    client.post("/api/jewellery", json={**payload, "stock_status": "sold"}, headers=auth)

    def total(**params) -> int:
        return client.get("/api/jewellery", params=params, headers=auth).json()["total"]

    assert total(store="test-store") == 2 and total(store="elsewhere") == 0
    assert total(published="true") == 1 and total(published="false") == 1
    assert total(stock="sold") == 1


def test_verify_hides_drafts_and_inactive_stores(client, auth, payload, publish, db):
    draft = client.post("/api/jewellery", json=payload, headers=auth).json()
    assert client.get(f"/api/verify/{draft['verification_token']}").status_code == 404

    live = publish()
    assert client.get(f"/api/verify/{live['verification_token']}").status_code == 200

    db.scalar(select(Store).where(Store.slug == "test-store")).status = "inactive"
    db.commit()
    res = client.get(f"/api/verify/{live['verification_token']}")
    assert res.status_code == 410 and res.json() == {"detail": "Record inactive"}


def test_verify_shows_only_what_the_level_vouches_for(client, publish):
    declared = client.get(f"/api/verify/{publish()['verification_token']}").json()
    assert declared["certificate_id"] is None  # the payload has one, but a declared piece doesn't vouch for it
    assert declared["store"]["name"] == "Test Jewellers" and declared["title"] == "Diamond ring"
    assert len(declared["photos"]) == 1 and declared["photos"][0]["alt"] == "Diamond ring"
    assert declared["price"]["basis"] == "registered" and declared["gold_rate"] is None

    hallmark = publish(verification_level="hallmark", huid="HU1D23")
    assert client.get(f"/api/verify/{hallmark['verification_token']}").json()["huid"] == "HU1D23"
```

- [ ] **Step 11: Run the whole suite**

Run: `cd backend && .venv/Scripts/python -m pytest -q`
Expected: PASS for every test (pricing, photos, migrations, API).

- [ ] **Step 12: Commit**

```bash
git add backend/app backend/alembic/versions/0005_marketplace_foundation.py backend/seed.py backend/tests
git commit -m "Move pieces onto stores with verification levels, publishing and discounts"
```

---

### Task 4: Stores API

**Files:**
- Modify: `backend/app/schemas.py` (add `Phone`, `StoreIn`, `StoreOut`)
- Create: `backend/app/routers/stores.py`
- Modify: `backend/app/main.py` (register the router)
- Test: `backend/tests/test_stores.py`

**Interfaces:**
- Consumes: `Store`, `Jewellery`, `Design` models; `field_error`; `photo_out`; `StoreRef`, `PhotoOut`, `Slug` (Task 3).
- Produces: `GET/POST /api/stores`, `GET/PUT/DELETE /api/stores/{slug}`, `POST /api/stores/{slug}/activate|deactivate`; `StoreIn`, `StoreOut` (adds `piece_count`, `design_count`, `photos`); `tests/test_stores.py::STORE` (a valid store body reused by Task 6).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_stores.py`:

```python
from decimal import Decimal

import pytest

STORE = {
    "name": "Shree Ganesh Jewellers",
    "address": "12 Sheikh Memon Street, Zaveri Bazaar",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": "18.9517",
    "longitude": "72.8331",
    "phone": "+91 98200 00000",
    "whatsapp": "",
    "hours": "Mon-Sat 11 am - 8 pm",
}


def test_stores_require_admin(client):
    assert client.get("/api/stores").status_code == 401
    assert client.post("/api/stores", json=STORE).status_code == 401


def test_create_and_get_store(client, auth):
    res = client.post("/api/stores", json=STORE, headers=auth)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "shree-ganesh-jewellers"
    assert body["phone"] == "+919820000000" and body["whatsapp"] is None
    assert Decimal(body["latitude"]) == Decimal("18.9517")
    assert (body["status"], body["piece_count"], body["design_count"], body["photos"]) == ("active", 0, 0, [])
    assert "id" not in body
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).json()["name"] == "Shree Ganesh Jewellers"
    assert client.get("/api/stores/nope", headers=auth).status_code == 404


def test_duplicate_names_get_distinct_slugs(client, auth):
    first = client.post("/api/stores", json=STORE, headers=auth).json()
    second = client.post("/api/stores", json=STORE, headers=auth).json()
    assert (first["slug"], second["slug"]) == ("shree-ganesh-jewellers", "shree-ganesh-jewellers-2")

    res = client.post("/api/stores", json={**STORE, "slug": "test-store"}, headers=auth)
    assert res.status_code == 422 and "slug" in res.json()["fields"]


@pytest.mark.parametrize("change, field", [
    ({"latitude": "91"}, "latitude"),
    ({"longitude": "-181"}, "longitude"),
    ({"phone": "12ab"}, "phone"),
    ({"name": " "}, "name"),
    ({"slug": "Not A Slug"}, "slug"),
])
def test_store_validation(client, auth, change, field):
    res = client.post("/api/stores", json={**STORE, **change}, headers=auth)
    assert res.status_code == 422 and field in res.json()["fields"], res.text


def test_coordinates_are_rounded_to_six_places(client, auth):
    body = client.post("/api/stores", json={**STORE, "latitude": "18.95170049", "longitude": 72.83310051},
                       headers=auth).json()
    assert (Decimal(body["latitude"]), Decimal(body["longitude"])) == (Decimal("18.951700"), Decimal("72.833101"))


def test_update_store_keeps_its_slug_unless_changed(client, auth):
    client.post("/api/stores", json=STORE, headers=auth)
    res = client.put("/api/stores/shree-ganesh-jewellers", json={**STORE, "name": "Shree Ganesh & Sons"}, headers=auth)
    assert (res.json()["slug"], res.json()["name"]) == ("shree-ganesh-jewellers", "Shree Ganesh & Sons")

    res = client.put("/api/stores/shree-ganesh-jewellers", json={**STORE, "slug": "ganesh-sons"}, headers=auth)
    assert res.json()["slug"] == "ganesh-sons"
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 404


def test_store_with_pieces_cannot_be_deleted(client, auth, payload):
    client.post("/api/jewellery", json=payload, headers=auth)
    assert client.delete("/api/stores/test-store", headers=auth).status_code == 409

    client.post("/api/stores", json=STORE, headers=auth)
    assert client.delete("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 204
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 404


def test_deactivating_a_store_hides_its_pieces(client, auth, publish):
    token = publish()["verification_token"]
    assert client.post("/api/stores/test-store/deactivate", headers=auth).json()["status"] == "inactive"
    assert client.get(f"/api/verify/{token}").status_code == 410
    assert client.post("/api/stores/test-store/activate", headers=auth).json()["status"] == "active"
    assert client.get(f"/api/verify/{token}").status_code == 200


def test_list_stores_with_counts(client, auth, payload):
    client.post("/api/jewellery", json=payload, headers=auth)
    client.post("/api/stores", json=STORE, headers=auth)
    stores = client.get("/api/stores", headers=auth).json()
    assert [(s["slug"], s["piece_count"]) for s in stores] == [("shree-ganesh-jewellers", 0), ("test-store", 1)]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_stores.py -q`
Expected: FAIL; `/api/stores` returns 404.

- [ ] **Step 3: Add the schemas**

In `backend/app/schemas.py`, add `from decimal import Decimal, InvalidOperation` (replacing `from decimal import Decimal`), add after the `Slug` alias:

```python
Phone = Annotated[str, Field(pattern=r"^\+?\d{8,15}$")]
```

and add a section after `# ---------- Shared ----------`'s classes:

```python
# ---------- Stores ----------

class StoreIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: Slug | None = None  # generated from the name when omitted
    address: str = Field(min_length=5, max_length=500)
    area: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)
    phone: Phone | None = None
    whatsapp: Phone | None = None
    hours: str = Field(min_length=2, max_length=200)

    @field_validator("name", "address", "area", "city", "hours", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("slug", mode="before")
    @classmethod
    def normalise_slug(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower() or None
        return v

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def digits_only(cls, v: object) -> object:
        """Accepts "+91 98200 00000" or "(022) 2345-6789" and stores just the digits and a leading +."""
        if isinstance(v, str):
            return re.sub(r"[\s\-().]", "", v) or None
        return v

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def six_places(cls, v: object) -> object:
        """Pasted map coordinates often have 8+ decimals; 6 is about 10 cm."""
        try:
            return Decimal(str(v)).quantize(Decimal("0.000001"))
        except (InvalidOperation, ValueError):
            return v


class StoreOut(StoreRef):
    address: str
    latitude: Decimal
    longitude: Decimal
    phone: str | None
    whatsapp: str | None
    hours: str
    status: str
    piece_count: int
    design_count: int
    photos: list[PhotoOut]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Write the router**

Create `backend/app/routers/stores.py`:

```python
import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.errors import field_error
from app.models import Design, Jewellery, Store
from app.schemas import StoreIn, StoreOut
from app.services.photos import photo_out

router = APIRouter(prefix="/api/stores", tags=["stores"], dependencies=[Depends(require_admin)])


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80].strip("-") or "store"


def get_or_404(db: Session, slug: str) -> Store:
    store = db.scalar(select(Store).where(Store.slug == slug.lower()))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


def counts(db: Session, store_id: int | None = None) -> tuple[dict[int, int], dict[int, int]]:
    """Pieces and designs per store id."""

    def per_store(column) -> dict[int, int]:
        query = select(column, func.count()).group_by(column)
        if store_id is not None:
            query = query.where(column == store_id)
        return dict(db.execute(query).all())

    return per_store(Jewellery.store_id), per_store(Design.store_id)


def to_out(store: Store, pieces: int, designs: int) -> StoreOut:
    return StoreOut.model_validate(
        {
            **{c.key: getattr(store, c.key) for c in Store.__table__.columns},
            "piece_count": pieces,
            "design_count": designs,
            "photos": [photo_out(p, store.name) for p in store.photos],
        }
    )


def one_out(db: Session, store: Store) -> StoreOut:
    pieces, designs = counts(db, store.id)
    return to_out(store, pieces.get(store.id, 0), designs.get(store.id, 0))


def unique_slug(db: Session, base: str) -> str:
    """`base`, or `base-2`, `base-3`... whichever no store uses yet."""
    candidate, n = base, 2
    while db.scalar(select(Store.id).where(Store.slug == candidate)) is not None:
        candidate = f"{base[:76]}-{n}"
        n += 1
    return candidate


def apply_fields(db: Session, store: Store, body: StoreIn) -> None:
    if body.slug:
        other = db.scalar(select(Store).where(Store.slug == body.slug))
        if other is not None and other is not store:
            raise field_error("slug", "Another store already uses this web address")
        store.slug = body.slug
    elif not store.slug:
        store.slug = unique_slug(db, slugify(body.name))
    for key, value in body.model_dump(exclude={"slug"}).items():
        setattr(store, key, value)


@router.get("", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db)) -> list[StoreOut]:
    stores = db.scalars(select(Store).order_by(Store.name, Store.id)).all()
    pieces, designs = counts(db)
    return [to_out(s, pieces.get(s.id, 0), designs.get(s.id, 0)) for s in stores]


@router.post("", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
def create_store(body: StoreIn, db: Session = Depends(get_db)) -> StoreOut:
    store = Store(status="active")
    apply_fields(db, store, body)
    db.add(store)
    db.commit()
    db.refresh(store)
    return one_out(db, store)


@router.get("/{slug}", response_model=StoreOut)
def get_store(slug: str, db: Session = Depends(get_db)) -> StoreOut:
    return one_out(db, get_or_404(db, slug))


@router.put("/{slug}", response_model=StoreOut)
def update_store(slug: str, body: StoreIn, db: Session = Depends(get_db)) -> StoreOut:
    store = get_or_404(db, slug)
    apply_fields(db, store, body)
    db.commit()
    db.refresh(store)
    return one_out(db, store)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_store(slug: str, db: Session = Depends(get_db)) -> Response:
    store = get_or_404(db, slug)
    pieces, designs = counts(db, store.id)
    if pieces or designs:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This store has pieces or designs. Deactivate it instead"
        )
    db.delete(store)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{slug}/deactivate", response_model=StoreOut)
def deactivate_store(slug: str, db: Session = Depends(get_db)) -> StoreOut:
    """Hides the store's pieces and designs from buyers; their QR pages say "no longer active"."""
    store = get_or_404(db, slug)
    store.status = "inactive"
    db.commit()
    return one_out(db, store)


@router.post("/{slug}/activate", response_model=StoreOut)
def activate_store(slug: str, db: Session = Depends(get_db)) -> StoreOut:
    store = get_or_404(db, slug)
    store.status = "active"
    db.commit()
    return one_out(db, store)
```

In `backend/app/main.py`, change the router import to `from app.routers import auth, jewellery, settings as settings_router, stores, verify` and add `app.include_router(stores.router)` after `app.include_router(jewellery.router)`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_stores.py -q` then `.venv/Scripts/python -m pytest -q`
Expected: PASS, then the whole suite passes.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/stores.py backend/app/main.py backend/tests/test_stores.py
git commit -m "Add the stores API"
```

---

### Task 5: Photo API

**Files:**
- Modify: `backend/app/deps.py` (add `optional_admin`)
- Create: `backend/app/routers/photos.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_photo_api.py`

**Interfaces:**
- Consumes: `process_image`, `read_upload`, `photo_out` (Tasks 2 and 3); `MAX_PHOTOS`; `Store`, `Jewellery`, `Design`, `Photo`.
- Produces:
  - `POST /api/{stores|jewellery|designs}/{key}/photos` (multipart `file`, optional `alt_text`) → 201, the owner's photos `list[PhotoOut]` in order
  - `PUT /api/{kind}/{key}/photos/order` body `{"photo_ids": [...]}` → `list[PhotoOut]`
  - `PUT /api/photos/{public_id}` body `{"alt_text": "..."}` → `list[PhotoOut]` of its owner
  - `DELETE /api/photos/{public_id}` → `list[PhotoOut]` of its owner
  - `GET /api/photos/{public_id}/{full|thumb}` → JPEG
  - `optional_admin(credentials, db) -> User | None` in `app/deps.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_photo_api.py`:

```python
from io import BytesIO

import pytest
from PIL import Image

IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable"


def jpeg(size=(800, 600)) -> bytes:
    img = Image.linear_gradient("L").resize(size).convert("RGB")
    buf = BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def upload(client, auth, path: str, alt: str = ""):
    return client.post(path, files={"file": ("p.jpg", jpeg(), "image/jpeg")}, data={"alt_text": alt}, headers=auth)


@pytest.fixture()
def piece(client, auth, payload) -> str:
    return client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]


def test_upload_requires_admin(client, piece):
    res = client.post(f"/api/jewellery/{piece}/photos", files={"file": ("p.jpg", jpeg(), "image/jpeg")})
    assert res.status_code == 401


def test_upload_and_list(client, auth, piece):
    res = upload(client, auth, f"/api/jewellery/{piece}/photos")
    assert res.status_code == 201, res.text
    [photo] = res.json()
    assert (photo["position"], photo["alt_text"], photo["alt"]) == (0, "", "Diamond ring")
    assert (photo["width"], photo["height"]) == (800, 600)

    res = upload(client, auth, f"/api/jewellery/{piece}/photos", alt="Side view")
    assert [p["alt"] for p in res.json()] == ["Diamond ring", "Side view"]
    record = client.get(f"/api/jewellery/{piece}", headers=auth).json()
    assert [p["public_id"] for p in record["photos"]] == [p["public_id"] for p in res.json()]


def test_at_most_six_photos(client, auth, piece):
    for _ in range(6):
        assert upload(client, auth, f"/api/jewellery/{piece}/photos").status_code == 201
    res = upload(client, auth, f"/api/jewellery/{piece}/photos")
    assert res.status_code == 422 and "6" in res.json()["detail"]


def test_rejects_bad_uploads(client, auth, piece, monkeypatch):
    res = client.post(f"/api/jewellery/{piece}/photos", files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")},
                      headers=auth)
    assert res.status_code == 422

    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "max_upload_mb", 0)
    assert upload(client, auth, f"/api/jewellery/{piece}/photos").status_code == 422


def test_unknown_owner(client, auth):
    assert upload(client, auth, "/api/jewellery/JWL-00-NOPE00/photos").status_code == 404
    assert upload(client, auth, "/api/widgets/x/photos").status_code == 422


def test_reorder_alt_text_and_delete(client, auth, piece):
    for _ in range(3):
        ids = [p["public_id"] for p in upload(client, auth, f"/api/jewellery/{piece}/photos").json()]

    res = client.put(f"/api/jewellery/{piece}/photos/order", json={"photo_ids": ids[::-1]}, headers=auth)
    assert [p["public_id"] for p in res.json()] == ids[::-1]
    assert client.put(f"/api/jewellery/{piece}/photos/order", json={"photo_ids": ids[:2]},
                      headers=auth).status_code == 422

    res = client.put(f"/api/photos/{ids[0]}", json={"alt_text": "  Clasp detail "}, headers=auth)
    assert {p["public_id"]: p["alt_text"] for p in res.json()}[ids[0]] == "Clasp detail"

    res = client.delete(f"/api/photos/{ids[1]}", headers=auth)
    assert [p["public_id"] for p in res.json()] == [ids[2], ids[0]]
    assert [p["position"] for p in res.json()] == [0, 1]


def test_published_piece_keeps_its_last_photo(client, auth, payload, piece):
    upload(client, auth, f"/api/jewellery/{piece}/photos")
    client.put(f"/api/jewellery/{piece}", json={**payload, "is_published": True}, headers=auth)
    [photo] = client.get(f"/api/jewellery/{piece}", headers=auth).json()["photos"]
    assert client.delete(f"/api/photos/{photo['public_id']}", headers=auth).status_code == 422


def test_photo_bytes_are_public_only_while_visible(client, auth, payload, piece):
    [photo] = upload(client, auth, f"/api/jewellery/{piece}/photos").json()
    full_url = f"/api/photos/{photo['public_id']}/full"
    assert client.get(full_url).status_code == 404  # a draft's photos are hidden from the public
    res = client.get(full_url, headers=auth)
    assert res.status_code == 200 and res.headers["cache-control"] == "private, no-store"

    client.put(f"/api/jewellery/{piece}", json={**payload, "is_published": True}, headers=auth)
    full, thumb = client.get(full_url), client.get(f"/api/photos/{photo['public_id']}/thumb")
    assert full.status_code == thumb.status_code == 200
    assert full.headers["content-type"] == "image/jpeg" and full.headers["cache-control"] == IMMUTABLE
    assert len(thumb.content) < len(full.content)
    assert client.get(f"/api/photos/{photo['public_id']}/huge").status_code == 422
    assert client.get("/api/photos/" + "0" * 32 + "/full").status_code == 404


def test_store_photos(client, auth):
    res = upload(client, auth, "/api/stores/test-store/photos")
    assert res.status_code == 201 and res.json()[0]["alt"] == "Test Jewellers"
    assert client.get(f"/api/photos/{res.json()[0]['public_id']}/thumb").status_code == 200  # active store
    assert client.get("/api/stores/test-store", headers=auth).json()["photos"][0]["public_id"] == res.json()[0]["public_id"]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_photo_api.py -q`
Expected: FAIL; the upload routes return 404.

- [ ] **Step 3: Add `optional_admin`**

Append to `backend/app/deps.py`:

```python
def optional_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """The signed-in admin, or None. For public routes that show admins a little more."""
    if credentials is None:
        return None
    try:
        user = get_current_user(credentials, db)
    except HTTPException:
        return None
    return user if user.role == "admin" else None
```

- [ ] **Step 4: Write the router**

Create `backend/app/routers/photos.py`:

```python
"""Photos for stores, pieces and designs: one set of routes for all three owners."""
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Response, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import MAX_PHOTOS
from app.database import get_db
from app.deps import optional_admin, require_admin
from app.models import Design, Jewellery, Photo, Store, User
from app.schemas import PhotoOut
from app.services.photos import photo_out, process_image, read_upload

router = APIRouter(tags=["photos"])

OwnerKind = Literal["stores", "jewellery", "designs"]
Owner = Store | Jewellery | Design
PublicId = Path(pattern=r"^[0-9a-f]{32}$")
# A photo's bytes never change (a new upload is a new id), so visible photos can be cached for a year
# by browsers and by Vercel's CDN.
PUBLIC_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable"


class PhotoOrder(BaseModel):
    photo_ids: list[str] = Field(min_length=1, max_length=MAX_PHOTOS)


class PhotoAlt(BaseModel):
    alt_text: str = Field(max_length=200)

    @field_validator("alt_text", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


def load_owner(db: Session, kind: str, key: str) -> Owner:
    if kind == "stores":
        owner = db.scalar(select(Store).where(Store.slug == key.lower()))
    elif kind == "jewellery":
        owner = db.scalar(select(Jewellery).where(Jewellery.jewellery_id == key.upper()))
    else:
        owner = db.scalar(select(Design).where(Design.public_id == key.upper()))
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return owner


def owner_of(db: Session, photo: Photo) -> Owner:
    if photo.store_id is not None:
        return db.get(Store, photo.store_id)
    if photo.piece_id is not None:
        return db.get(Jewellery, photo.piece_id)
    return db.get(Design, photo.design_id)


def title_of(owner: Owner) -> str:
    return owner.name if isinstance(owner, Store) else owner.title


def visible_to_buyers(owner: Owner) -> bool:
    if isinstance(owner, Store):
        return owner.status == "active"
    if isinstance(owner, Jewellery):
        return owner.is_published and owner.is_active
    return owner.is_visible


def photos_out(db: Session, owner: Owner) -> list[PhotoOut]:
    db.expire(owner, ["photos"])  # reload in position order after a change
    return [photo_out(p, title_of(owner)) for p in owner.photos]


def get_photo_or_404(db: Session, public_id: str) -> Photo:
    photo = db.scalar(select(Photo).where(Photo.public_id == public_id))
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return photo


@router.post(
    "/api/{kind}/{key}/photos",
    response_model=list[PhotoOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def upload_photo(
    kind: OwnerKind,
    key: str,
    file: UploadFile = File(...),
    alt_text: str = Form("", max_length=200),
    db: Session = Depends(get_db),
) -> list[PhotoOut]:
    owner = load_owner(db, kind, key)
    if len(owner.photos) >= MAX_PHOTOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Up to {MAX_PHOTOS} photos. Delete one to add another",
        )
    processed = process_image(await read_upload(file))
    owner.photos.append(
        Photo(
            public_id=secrets.token_hex(16),
            position=len(owner.photos),
            alt_text=alt_text.strip(),
            image=processed.image,
            thumbnail=processed.thumbnail,
            width=processed.width,
            height=processed.height,
        )
    )
    db.commit()
    return photos_out(db, owner)


@router.put("/api/{kind}/{key}/photos/order", response_model=list[PhotoOut], dependencies=[Depends(require_admin)])
def reorder_photos(kind: OwnerKind, key: str, body: PhotoOrder, db: Session = Depends(get_db)) -> list[PhotoOut]:
    owner = load_owner(db, kind, key)
    by_id = {p.public_id: p for p in owner.photos}
    if sorted(body.photo_ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Send every photo of this item exactly once"
        )
    for position, public_id in enumerate(body.photo_ids):
        by_id[public_id].position = position
    db.commit()
    return photos_out(db, owner)


@router.put("/api/photos/{public_id}", response_model=list[PhotoOut], dependencies=[Depends(require_admin)])
def update_alt_text(body: PhotoAlt, public_id: str = PublicId, db: Session = Depends(get_db)) -> list[PhotoOut]:
    photo = get_photo_or_404(db, public_id)
    photo.alt_text = body.alt_text
    db.commit()
    return photos_out(db, owner_of(db, photo))


@router.delete("/api/photos/{public_id}", response_model=list[PhotoOut], dependencies=[Depends(require_admin)])
def delete_photo(public_id: str = PublicId, db: Session = Depends(get_db)) -> list[PhotoOut]:
    photo = get_photo_or_404(db, public_id)
    owner = owner_of(db, photo)
    if not isinstance(owner, Store) and owner.is_published and len(owner.photos) == 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A published item needs at least one photo. Unpublish it first, or add another photo",
        )
    owner.photos.remove(photo)
    for position, remaining in enumerate(owner.photos):
        remaining.position = position
    db.commit()
    return photos_out(db, owner)


@router.get(
    "/api/photos/{public_id}/{size}",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}}, 404: {"description": "No such photo, or not public"}},
)
def photo_file(
    size: Literal["full", "thumb"],
    public_id: str = PublicId,
    viewer: User | None = Depends(optional_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Public while the photo's store, piece or design is visible to buyers; otherwise admins only."""
    photo = get_photo_or_404(db, public_id)
    public = visible_to_buyers(owner_of(db, photo))
    if not public and viewer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    return Response(
        content=photo.image if size == "full" else photo.thumbnail,
        media_type="image/jpeg",
        headers={"Cache-Control": PUBLIC_CACHE if public else "private, no-store"},
    )
```

In `backend/app/main.py`, add `photos` to the router import and `app.include_router(photos.router)` after the stores router.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_photo_api.py -q` then `.venv/Scripts/python -m pytest -q`
Expected: PASS, then the whole suite passes.

- [ ] **Step 6: Commit**

```bash
git add backend/app/deps.py backend/app/routers/photos.py backend/app/main.py backend/tests/test_photo_api.py
git commit -m "Add photo upload, ordering and serving for stores, pieces and designs"
```

---

### Task 6: Designs API

**Files:**
- Modify: `backend/app/schemas.py` (add `DesignIn`, `DesignOut`), `backend/app/services/identifiers.py` (add `new_design_id`), `backend/app/main.py` (router; validation handler uses the top-level field)
- Create: `backend/app/routers/designs.py`
- Test: `backend/tests/test_designs.py`

**Interfaces:**
- Consumes: `Design`, `Store` models; `field_error`; `photo_out`; `StoreRef`, `PhotoOut`, `Slug`, `Weight`, `Purity`, `JewelleryType`; photo routes (Task 5) in the tests; `tests.test_stores.STORE`.
- Produces: `GET/POST /api/designs` (list filters `store`, `published`), `GET/PUT/DELETE /api/designs/{public_id}`; `DesignIn`, `DesignOut`; `new_design_id(db) -> str` (`DSN` + 7 characters).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_designs.py`:

```python
from io import BytesIO

import pytest
from PIL import Image

from tests.test_stores import STORE

DESIGN = {
    "store": "test-store",
    "title": "Temple necklace",
    "description": "Lakshmi motif with kemp stones",
    "category": "Necklace",
    "purity_options": ["22K", "18K"],
    "weight_min": "30",
    "weight_max": "45",
    "price_min": "350000",
    "price_max": "520000",
    "making_days_min": 14,
    "making_days_max": 21,
}


def jpeg() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (400, 300), (200, 160, 60)).save(buf, "JPEG")
    return buf.getvalue()


def create(client, auth, **changes):
    return client.post("/api/designs", json={**DESIGN, **changes}, headers=auth)


def test_designs_require_admin(client):
    assert client.get("/api/designs").status_code == 401


def test_create_design(client, auth):
    res = create(client, auth)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["public_id"].startswith("DSN") and len(body["public_id"]) == 10
    assert body["purity_options"] == ["22K", "18K"] and body["store"]["slug"] == "test-store"
    assert body["is_published"] is False and body["photos"] == []
    for absent in ("jewellery_id", "verification_level", "verification_token", "discount_type", "id"):
        assert absent not in body  # a design is never presented as a verified piece
    assert client.get(f"/api/designs/{body['public_id']}", headers=auth).json()["title"] == "Temple necklace"


def test_purities_are_ordered_and_deduplicated(client, auth):
    assert create(client, auth, purity_options=["18K", "22K", "18K"]).json()["purity_options"] == ["22K", "18K"]


@pytest.mark.parametrize("change, field", [
    ({"weight_max": "20"}, "weight_max"),
    ({"price_max": "100"}, "price_max"),
    ({"making_days_max": 7}, "making_days_max"),
    ({"making_days_min": 0}, "making_days_min"),
    ({"purity_options": []}, "purity_options"),
    ({"purity_options": ["30K"]}, "purity_options"),
    ({"store": "nowhere"}, "store"),
    ({"price_min": "0"}, "price_min"),
])
def test_design_validation(client, auth, change, field):
    res = create(client, auth, **change)
    assert res.status_code == 422 and field in res.json()["fields"], res.text


def test_publishing_needs_a_photo(client, auth):
    assert "is_published" in create(client, auth, is_published=True).json()["fields"]

    pid = create(client, auth).json()["public_id"]
    res = client.post(f"/api/designs/{pid}/photos", files={"file": ("d.jpg", jpeg(), "image/jpeg")}, headers=auth)
    assert res.status_code == 201
    res = client.put(f"/api/designs/{pid}", json={**DESIGN, "is_published": True}, headers=auth)
    assert res.status_code == 200 and res.json()["is_published"] is True

    photo = res.json()["photos"][0]["public_id"]
    assert client.get(f"/api/photos/{photo}/thumb").status_code == 200  # published design: public
    assert client.delete(f"/api/photos/{photo}", headers=auth).status_code == 422  # its only photo


def test_list_filters_and_delete(client, auth):
    first = create(client, auth).json()["public_id"]
    create(client, auth, title="Bridal choker")
    assert len(client.get("/api/designs", params={"store": "test-store"}, headers=auth).json()) == 2
    assert client.get("/api/designs", params={"store": "elsewhere"}, headers=auth).json() == []
    assert client.get("/api/designs", params={"published": "true"}, headers=auth).json() == []

    assert client.delete(f"/api/designs/{first}", headers=auth).status_code == 204
    assert client.get(f"/api/designs/{first}", headers=auth).status_code == 404


def test_store_with_designs_cannot_be_deleted(client, auth):
    slug = client.post("/api/stores", json=STORE, headers=auth).json()["slug"]
    create(client, auth, store=slug)
    assert client.delete(f"/api/stores/{slug}", headers=auth).status_code == 409
    assert client.get("/api/jewellery/stats", headers=auth).json()["designs"] == 1
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_designs.py -q`
Expected: FAIL; `/api/designs` returns 404.

- [ ] **Step 3: Report nested validation errors under their field**

A list item error has a location like `("body", "purity_options", 0)`; the form needs it under `purity_options`. In `backend/app/main.py`'s `validation_error_handler`, change `fields.setdefault(loc[-1], msg)` to:

```python
            fields.setdefault(loc[0], msg)  # the top-level field, also for list items like purity_options[0]
```

(for every existing flat error `loc[0] == loc[-1]`, so nothing else changes).

- [ ] **Step 4: Add the schemas and the ID generator**

In `backend/app/schemas.py`, add after `Phone`:

```python
Price = Annotated[Decimal, Field(gt=0, le=999999999, max_digits=12, decimal_places=2)]
Days = Annotated[int, Field(ge=1, le=365)]
```

and a section after `# ---------- Stores ----------`:

```python
# ---------- Designs ----------

class DesignIn(BaseModel):
    store: Slug
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category: JewelleryType
    purity_options: list[Purity] = Field(min_length=1, max_length=4)
    weight_min: Weight
    weight_max: Weight
    price_min: Price
    price_max: Price
    making_days_min: Days
    making_days_max: Days
    is_published: bool = False

    @field_validator("store", "title", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("description", mode="before")
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("purity_options")
    @classmethod
    def in_karat_order(cls, purities: list[str]) -> list[str]:
        return [p for p in PURITY_PERCENT if p in purities]  # also drops duplicates

    @field_validator("weight_max", "price_max", "making_days_max")
    @classmethod
    def max_not_below_min(cls, value, info: ValidationInfo):
        low = info.data.get(info.field_name.replace("_max", "_min"))
        if low is not None and value < low:
            raise ValueError("Can't be below the minimum")
        return value


class DesignOut(BaseModel):
    public_id: str
    store: StoreRef
    title: str
    description: str | None
    category: str
    purity_options: list[str]
    weight_min: Decimal
    weight_max: Decimal
    price_min: Decimal
    price_max: Decimal
    making_days_min: int
    making_days_max: int
    is_published: bool
    photos: list[PhotoOut]
    created_at: datetime
    updated_at: datetime
```

In `backend/app/services/identifiers.py`, change the model import to `from app.models import Design, Jewellery` and append:

```python
def new_design_id(db: Session) -> str:
    # "DSN" + 7: never confused with a Jewellery ID, which designs don't have.
    while True:
        candidate = f"DSN{_random_code(7)}"
        if not db.scalar(select(exists().where(Design.public_id == candidate))):
            return candidate
```

- [ ] **Step 5: Write the router**

Create `backend/app/routers/designs.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.errors import field_error
from app.models import Design, Store
from app.schemas import DesignIn, DesignOut, StoreRef
from app.services.identifiers import new_design_id
from app.services.photos import photo_out

router = APIRouter(prefix="/api/designs", tags=["designs"], dependencies=[Depends(require_admin)])


def to_out(design: Design) -> DesignOut:
    return DesignOut.model_validate(
        {
            **{c.key: getattr(design, c.key) for c in Design.__table__.columns},
            "store": StoreRef.model_validate(design.store),
            "purity_options": design.purities,
            "photos": [photo_out(p, design.title) for p in design.photos],
        }
    )


def get_or_404(db: Session, public_id: str) -> Design:
    design = db.scalar(select(Design).where(Design.public_id == public_id.upper()))
    if design is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")
    return design


def apply_fields(db: Session, design: Design, body: DesignIn) -> None:
    store = db.scalar(select(Store).where(Store.slug == body.store))
    if store is None:
        raise field_error("store", "Choose one of the stores")
    for key, value in body.model_dump(exclude={"store", "purity_options"}).items():
        setattr(design, key, value)
    design.store = store
    design.purity_options = ",".join(body.purity_options)
    if design.is_published and not design.photos:
        raise field_error("is_published", "Add at least one photo before publishing")


@router.get("", response_model=list[DesignOut])
def list_designs(
    db: Session = Depends(get_db),
    store: str | None = Query(None, max_length=80),
    published: bool | None = None,
) -> list[DesignOut]:
    query = select(Design).order_by(Design.created_at.desc(), Design.id.desc())
    if store:
        query = query.where(Design.store_id == select(Store.id).where(Store.slug == store).scalar_subquery())
    if published is not None:
        query = query.where(Design.is_published == published)
    return [to_out(d) for d in db.scalars(query).all()]


@router.post("", response_model=DesignOut, status_code=status.HTTP_201_CREATED)
def create_design(body: DesignIn, db: Session = Depends(get_db)) -> DesignOut:
    design = Design(public_id=new_design_id(db))
    apply_fields(db, design, body)
    db.add(design)
    db.commit()
    db.refresh(design)
    return to_out(design)


@router.get("/{public_id}", response_model=DesignOut)
def get_design(public_id: str, db: Session = Depends(get_db)) -> DesignOut:
    return to_out(get_or_404(db, public_id))


@router.put("/{public_id}", response_model=DesignOut)
def update_design(public_id: str, body: DesignIn, db: Session = Depends(get_db)) -> DesignOut:
    design = get_or_404(db, public_id)
    apply_fields(db, design, body)
    db.commit()
    db.refresh(design)
    return to_out(design)


@router.delete("/{public_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_design(public_id: str, db: Session = Depends(get_db)) -> Response:
    """Designs have no QR code, so they can be deleted outright; their photos go with them."""
    db.delete(get_or_404(db, public_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

In `backend/app/main.py`, add `designs` to the router import and `app.include_router(designs.router)` after the photos router.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_designs.py -q` then `.venv/Scripts/python -m pytest -q`
Expected: PASS, then the whole suite passes.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas.py backend/app/services/identifiers.py backend/app/routers/designs.py backend/app/main.py backend/tests/test_designs.py
git commit -m "Add the designs API"
```

---

### Task 7: Seed and README

**Files:**
- Modify: `backend/seed.py`, `README.md`
- Test: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `Store`, `Jewellery`, `Photo` models; `process_image` (Task 2); `get_store_settings` (Task 3).
- Produces: `seed.seed()` creating the placeholder store (if no stores exist), the admin, and the 5 pieces, published, each with one processed photo.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_seed.py`:

```python
"""seed.py on a fresh database: one placeholder store and the five pieces, published with photos; safe to rerun."""
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import seed
from app.database import Base
from app.models import Jewellery, Photo, Store, User


def test_seed_is_complete_and_idempotent(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(seed, "SessionLocal", sessionmaker(bind=engine, autoflush=False, expire_on_commit=False))

    seed.seed()
    seed.seed()

    with sessionmaker(bind=engine)() as db:
        assert db.scalar(select(func.count(User.id))) == 1
        [store] = db.scalars(select(Store)).all()
        assert (store.name, store.city, store.area, store.phone) == ("Your Store Name", "Mumbai", "Zaveri Bazaar", None)
        pieces = db.scalars(select(Jewellery)).all()
        assert {p.title for p in pieces} == {"Nakshi kada", "Hollow chain", "Rani haar", "Casting ring",
                                             "Jaguar bracelet"}
        assert all(p.is_published and p.verification_level == "declared" and p.store_id == store.id for p in pieces)
        assert db.scalar(select(func.count(Photo.id))) == 5
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_seed.py -q`
Expected: FAIL; the current seed writes `photo=` on `Jewellery`, which no longer has that column (`TypeError: 'photo' is an invalid keyword argument`).

- [ ] **Step 3: Rewrite the seed**

Replace `backend/seed.py` with:

```python
"""Seed the database with an admin account, the store and its jewellery.

Idempotent: the admin is only created if the email is missing, the store only if there are no stores,
and each piece only if its Jewellery ID isn't there yet.
Run with:  python seed.py
"""
import secrets
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Jewellery, Photo, Store, User
from app.security import hash_password
from app.services.photos import process_image
from app.services.store import get_store_settings

D = Decimal
GST = D("0.03")
PHOTOS = Path(__file__).resolve().parent / "seed_photos"

# 22K rate per gram used for the registered (billed) amounts. Buyers see the live market price
# whenever a gold rate API key is set; these figures are the fallback.
REGISTERED_RATE_22K = D("13700")  # IBJA 22K, 11 Oct 2026

# Placeholder details until the team edits the store in admin. Phone and WhatsApp stay empty rather
# than holding a made-up number that might belong to someone.
STORE = {
    "slug": "your-store-name",
    "name": "Your Store Name",
    "address": "Placeholder address, Zaveri Bazaar, Mumbai",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": D("18.951700"),
    "longitude": D("72.833100"),
    "hours": "Placeholder: Mon-Sat 11 am - 8 pm",
}

# (jewellery_id, token, type, title, description, colour, design details, purity, weight (g),
#  making charges range in % of gold value, photo, days_ago)
# The weights on the tags are used as both gross and net gold weight. Correct them from Edit if a
# piece's gross weight differs (stones, strap).
PRODUCTS = [
    ("JWL-26-B2TPBR", "UWPVS7T9QZR9", "Bangle", "Nakshi kada", "Nakshi kada in 22K gold",
     "Yellow gold",
     "Hand-engraved nakshi work with twin lion-head clasp and red stone eyes, ribbed body and leaf-pattern border.",
     "22K", "25.940", ("14", "18"), "nakshi-kada.jpg", 1),
    ("JWL-26-C7HWNK", "PHY5GUC34N8U", "Chain", "Hollow chain", "Hollow chain in 22K gold",
     "Yellow gold",
     "Lightweight hollow links woven in a twisted rope pattern.",
     "22K", "8.850", ("8", "12"), "hollow-chain.jpg", 2),
    ("JWL-26-RF3D4S", "2HGN47ZX72WF", "Necklace", "Rani haar", "Rani haar in 22K gold with a peacock pendant",
     "Yellow gold",
     "Round peacock pendant with red, green and blue enamel, floral centrepiece with stone accents, "
     "teardrop charm and fine chain sides.",
     "22K", "10.760", ("12", "16"), "rani-haar.jpg", 3),
    ("JWL-26-ABKUCR", "T3CMCQCGXRFB", "Ring", "Casting ring", "Casting ring in 22K gold",
     "Yellow gold",
     "Square signet face with a red enamel monogram on a textured ground, Greek key border and engraved shoulders.",
     "22K", "4.880", ("10", "14"), "casting-ring.jpg", 4),
    ("JWL-26-EMQXKD", "YDYXKM846872", "Bracelet", "Jaguar bracelet", "Jaguar bracelet in 22K gold",
     "Yellow gold",
     "Twin interlocking jaguars set with white stones and green enamel spots, on a black rubber strap.",
     "22K", "6.140", ("12", "16"), "jaguar-bracelet.jpg", 5),
]


def rupees(value: Decimal) -> Decimal:
    return value.quantize(D("1"), rounding=ROUND_HALF_UP)


def seed() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        email = settings.seed_admin_email.strip().lower()
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(
                name=settings.seed_admin_name,
                email=email,
                password_hash=hash_password(settings.seed_admin_password),
                role="admin",
                status="active",
            ))
            print(f"Created admin user {email}")

        get_store_settings(db)
        store = db.scalar(select(Store).order_by(Store.id))
        if store is None:
            store = Store(**STORE, status="active")
            db.add(store)
            db.flush()
            print(f"Created store {store.name}")

        existing = set(db.scalars(select(Jewellery.jewellery_id)))
        now = datetime.now(timezone.utc)
        added = 0
        for (jid, token, jtype, title, desc, colour, design, purity, weight, (pmin, pmax), photo,
             days_ago) in PRODUCTS:
            if jid in existing:
                continue
            gold = rupees(D(weight) * REGISTERED_RATE_22K)
            making = rupees(gold * (D(pmin) + D(pmax)) / 2 / 100)
            tax = rupees((gold + making) * GST)
            image = process_image((PHOTOS / photo).read_bytes())
            created = now - timedelta(days=days_ago)
            db.add(Jewellery(
                jewellery_id=jid,
                verification_token=token,
                store=store,
                title=title,
                type=jtype,
                description=desc,
                colour=colour,
                design_details=design,
                purity=purity,
                gross_weight=D(weight),
                net_weight=D(weight),
                verification_level="declared",
                gold_value=gold,
                making_charges=making,
                other_component_value=D("0"),
                tax=tax,
                total_price=gold + making + tax,
                making_percent_min=D(pmin),
                making_percent_max=D(pmax),
                stock_status="in_stock",
                is_published=True,
                status="active",
                created_at=created,
                updated_at=created,
                photos=[Photo(
                    public_id=secrets.token_hex(16),
                    position=0,
                    alt_text="",
                    image=image.image,
                    thumbnail=image.thumbnail,
                    width=image.width,
                    height=image.height,
                )],
            ))
            added += 1
        print(f"Inserted {added} jewellery records" if added else "Jewellery already seeded")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_seed.py -q` then `.venv/Scripts/python -m pytest -q`
Expected: PASS, then the whole suite passes.

- [ ] **Step 5: Update the README**

In `README.md`:

a) Replace the five table bullets in `## 5. Database` (from `- **\`users\`**` to the `gold_rates` bullet) with:

```markdown
- **`users`**: `id, name, email, password_hash, role, status, token_version, created_at`
- **`stores`**: `id, slug, name, address, area, city, latitude, longitude, phone, whatsapp, hours, status, created_at, updated_at`
- **`jewellery`** (pieces): `id, jewellery_id, verification_token, store_id, title, type, description, colour, design_details, purity, gross_weight, net_weight, verification_level, huid, certificate_id, issuing_authority, certificate_date, certificate_document, gold_value, making_charges, other_component_value, tax, total_price, making_percent_min, making_percent_max, discount_type, discount_value, discount_ends_on, stock_status, is_published, status, created_at, updated_at`
- **`designs`** (made to order): `id, public_id, store_id, title, description, category, purity_options, weight_min, weight_max, price_min, price_max, making_days_min, making_days_max, is_published, created_at, updated_at`
- **`photos`**: one row per photo of a store, piece or design (`public_id, store_id | piece_id | design_id, position, alt_text, image, thumbnail, width, height`). Uploads are resized to 1600 px and 600 px JPEGs with their metadata (including GPS) removed.
- **`certificate_files`**: uploaded certificate documents (`name, data`)
- **`store_settings`**: one row with the marketplace-wide `gst_percent`
- **`gold_rates`**: each successful market fetch (`inr_per_gram_24k, source, fetched_at`); the latest is the current rate
```

and change the seed comment line to `python seed.py            # idempotent: adds the placeholder store and any missing pieces`.

b) In `## 7. API summary`, replace the rows from `| GET | \`/api/jewellery/stats\`` to the end of the table with:

```markdown
| GET | `/api/jewellery/stats` | admin | Pieces (total / published / in stock / inactive), stores and designs |
| POST | `/api/jewellery/price-preview` | admin | The price buyers would see for the given figures and discount |
| GET | `/api/jewellery/{jewellery_id}` | admin | One record, with its current price |
| PUT | `/api/jewellery/{jewellery_id}` | admin | Update (QR stays the same) |
| DELETE | `/api/jewellery/{jewellery_id}` | admin | Deactivate (soft delete) |
| POST | `/api/jewellery/{jewellery_id}/activate` | admin | Reactivate |
| GET | `/api/jewellery/{jewellery_id}/qr` | admin | Print-resolution QR PNG (~1200 px, 300 dpi) |
| POST / GET / DELETE | `/api/jewellery/{jewellery_id}/certificate` | admin | Upload / download / remove certificate (PDF, JPG, PNG, ≤ 4 MB) |
| GET / POST | `/api/stores` | admin | List (with piece and design counts) / add a store |
| GET / PUT / DELETE | `/api/stores/{slug}` | admin | One store / update / delete (`409` while it has pieces or designs) |
| POST | `/api/stores/{slug}/activate`, `/deactivate` | admin | Show or hide the store and everything it sells |
| GET / POST | `/api/designs` | admin | List with `store`, `published` / add a made-to-order design |
| GET / PUT / DELETE | `/api/designs/{public_id}` | admin | One design / update / delete |
| POST | `/api/{stores\|jewellery\|designs}/{key}/photos` | admin | Upload a photo (JPG, PNG, ≤ 4 MB; up to 6) |
| PUT | `/api/{stores\|jewellery\|designs}/{key}/photos/order` | admin | Reorder photos; the first is the cover |
| PUT / DELETE | `/api/photos/{public_id}` | admin | Edit alt text / delete a photo |
| GET | `/api/photos/{public_id}/full`, `/thumb` | public* | The image. *Public while its owner is visible to buyers, admin-only otherwise |
| GET / PUT | `/api/settings` | admin | GST % and the current gold rate |
| GET | `/api/verify/{token}` | public | Buyer view: store, photos, verification level, live gold rate and price. `404` not found or unpublished, `410` inactive (no details returned) |
```

c) In `## 8. How QR verification works`, replace the four-bullet list under step 4 with:

```markdown
   - **Lab verified** → certificate ID, issuer and date shown; a certificate file is on record
   - **Hallmark linked** → the BIS HUID is shown
   - **Declared by store** → the store's own details, with no certificate or HUID vouched for
   - **Deactivated, or the store is inactive** → *Record inactive*, with no jewellery details shown
   - **Unknown or unpublished** → *Verification record not found*
```

d) In `### Live pricing`, replace the four "Gold value / Making charges / Tax / Live price" bullets with:

```markdown
- **Gold value** = net gold weight × (market rate per gram of pure gold × purity, e.g. 91.6% for 22K)
- **Making charges** = the item's making range in % of that gold value (set per item; without a range, the fixed amount)
- **Tax** = the GST % on gold value + making charges + other components
- **Original price** = the sum, shown as a range when making charges are a range
- **Discount** = a percent or flat amount off both ends (at most 90%), until its end date; never on sold pieces
- **Final price** = original − discount. Every line is rounded to the rupee first, so the lines add up exactly.
```

and in the paragraph below, replace `The registered price stays on the page for reference.` with `If no rate has ever been fetched, the registered amounts are used instead, so a price always shows.`

- [ ] **Step 6: Commit**

```bash
git add backend/seed.py backend/tests/test_seed.py README.md
git commit -m "Seed the placeholder store and document the marketplace data model"
```

---

### Task 8: Frontend types and services

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/services/jewellery.ts`, `frontend/src/services/verify.ts`, `frontend/src/services/settings.ts`, `frontend/src/utils/format.ts`
- Create: `frontend/src/services/stores.ts`, `frontend/src/services/designs.ts`, `frontend/src/services/photos.ts`

**Interfaces:**
- Consumes: the API shapes from Tasks 3 to 6.
- Produces (TypeScript): `VERIFICATION_LEVELS`, `VerificationLevel`, `VERIFICATION_LABEL`, `STOCK_STATUSES`, `StockStatus`, `STOCK_LABEL`, `DiscountType`, `Photo`, `PhotoOwner`, `StoreRef`, `Store`, `StoreInput`, `PriceDiscount`, `PiecePrice`, `Jewellery`, `JewelleryInput`, `PricePreviewInput`, `JewelleryStats`, `JewelleryQuery`, `Design`, `DesignInput`, `StoreSettings`, `PublicVerification`; `storeService`, `designService`, `photoService` (with `PhotoSize`), `jewelleryService.pricePreview`; `formatDateTime(iso)`.

This task changes types that existing pages use, so `tsc` fails until Tasks 9 to 13 update those pages. Each step below is checked with the build at the end of Task 13; within this task, check only that the new files compile on their own (Step 4).

- [ ] **Step 1: Replace the types**

Replace `frontend/src/types/index.ts` with:

```ts
export const JEWELLERY_TYPES = ["Ring", "Necklace", "Bracelet", "Chain", "Earrings", "Bangle", "Pendant", "Other"] as const;
export type JewelleryType = (typeof JEWELLERY_TYPES)[number];

export const PURITIES = ["24K", "22K", "18K", "14K"] as const;
export type Purity = (typeof PURITIES)[number];

export const PURITY_PERCENT: Record<Purity, string> = {
  "24K": "99.9",
  "22K": "91.6",
  "18K": "75.0",
  "14K": "58.5",
};

export const GOLD_COLOURS = ["Yellow gold", "Rose gold", "White gold", "Two-tone", "Multi-tone"] as const;
export type GoldColour = (typeof GOLD_COLOURS)[number];

/** How far the store vouches for a piece. The badge buyers see always matches it. */
export const VERIFICATION_LEVELS = ["declared", "hallmark", "lab"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];
export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  declared: "Declared by store",
  hallmark: "Hallmark linked",
  lab: "Lab verified",
};

export const STOCK_STATUSES = ["in_stock", "reserved", "sold"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];
export const STOCK_LABEL: Record<StockStatus, string> = { in_stock: "In stock", reserved: "Reserved", sold: "Sold" };

export type DiscountType = "percent" | "flat";
export type RecordStatus = "active" | "inactive";

export interface User {
  name: string;
  email: string;
  role: string;
}

export interface AdminUser extends User {
  status: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

/** Decimal values arrive from the API as strings to keep exact precision. */
export type DecimalString = string;

export interface Photo {
  public_id: string;
  /** As entered; blank means "use the title". */
  alt_text: string;
  /** What screen readers get. */
  alt: string;
  width: number;
  height: number;
  position: number;
}

export type PhotoOwner = "stores" | "jewellery" | "designs";

export interface StoreRef {
  slug: string;
  name: string;
  area: string;
  city: string;
}

export interface Store extends StoreRef {
  address: string;
  latitude: DecimalString;
  longitude: DecimalString;
  phone: string | null;
  whatsapp: string | null;
  hours: string;
  status: RecordStatus;
  piece_count: number;
  design_count: number;
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

export interface StoreInput {
  name: string;
  slug: string | null;
  address: string;
  area: string;
  city: string;
  latitude: string;
  longitude: string;
  phone: string | null;
  whatsapp: string | null;
  hours: string;
}

export interface PriceDiscount {
  type: DiscountType;
  value: DecimalString;
  /** "10% off" or "₹5,000 off" */
  label: string;
  amount_min: DecimalString;
  amount_max: DecimalString;
  ends_on: string | null;
}

/** A piece's price right now, in whole rupees. gold + making + other + tax = original; original − discount = final. */
export interface PiecePrice {
  basis: "live" | "registered";
  as_of: string;
  rate_per_gram: DecimalString | null;
  gold: DecimalString;
  making_min: DecimalString;
  making_max: DecimalString;
  making_percent_min: DecimalString | null;
  making_percent_max: DecimalString | null;
  other: DecimalString;
  gst_percent: DecimalString;
  tax_min: DecimalString;
  tax_max: DecimalString;
  original_min: DecimalString;
  original_max: DecimalString;
  discount: PriceDiscount | null;
  final_min: DecimalString;
  final_max: DecimalString;
}

export interface Jewellery {
  jewellery_id: string;
  verification_token: string;
  verification_url: string;
  store: StoreRef;
  title: string;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  photos: Photo[];
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
  verification_level: VerificationLevel;
  huid: string | null;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  has_certificate_document: boolean;
  gold_value: DecimalString;
  making_charges: DecimalString;
  other_component_value: DecimalString;
  tax: DecimalString;
  total_price: DecimalString;
  making_percent_min: DecimalString | null;
  making_percent_max: DecimalString | null;
  discount_type: DiscountType | null;
  discount_value: DecimalString | null;
  discount_ends_on: string | null;
  stock_status: StockStatus;
  is_published: boolean;
  price: PiecePrice;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface JewelleryInput {
  store: string;
  title: string;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  purity: Purity;
  gross_weight: string;
  net_weight: string;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  verification_level: VerificationLevel;
  huid: string | null;
  gold_value: string;
  making_charges: string;
  other_component_value: string;
  tax: string;
  total_price: string | null;
  making_percent_min: string | null;
  making_percent_max: string | null;
  stock_status: StockStatus;
  is_published: boolean;
  discount_type: DiscountType | null;
  discount_value: string | null;
  discount_ends_on: string | null;
  status?: RecordStatus;
}

export type PricePreviewInput = Pick<
  JewelleryInput,
  | "purity"
  | "net_weight"
  | "gold_value"
  | "making_charges"
  | "other_component_value"
  | "tax"
  | "making_percent_min"
  | "making_percent_max"
  | "discount_type"
  | "discount_value"
  | "discount_ends_on"
  | "stock_status"
>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface JewelleryStats {
  total: number;
  published: number;
  in_stock: number;
  inactive: number;
  stores: number;
  designs: number;
}

export type SortField = "created_at" | "jewellery_id" | "type" | "net_weight" | "total_price";

export interface JewelleryQuery {
  search?: string;
  type?: JewelleryType | "";
  purity?: Purity | "";
  status?: RecordStatus | "";
  store?: string;
  published?: "true" | "false" | "";
  stock?: StockStatus | "";
  sort?: SortField;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface Design {
  public_id: string;
  store: StoreRef;
  title: string;
  description: string | null;
  category: JewelleryType;
  purity_options: Purity[];
  weight_min: DecimalString;
  weight_max: DecimalString;
  price_min: DecimalString;
  price_max: DecimalString;
  making_days_min: number;
  making_days_max: number;
  is_published: boolean;
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

export interface DesignInput {
  store: string;
  title: string;
  description: string | null;
  category: JewelleryType;
  purity_options: Purity[];
  weight_min: string;
  weight_max: string;
  price_min: string;
  price_max: string;
  making_days_min: number;
  making_days_max: number;
  is_published: boolean;
}

/** Market rate per gram for each karat. `change_percent` is the move since the previous fetch. */
export interface GoldRate {
  per_gram: Record<Purity, DecimalString>;
  change_percent: DecimalString | null;
  updated_at: string;
  source: string;
}

export interface StoreSettings {
  gst_percent: DecimalString;
  gold_feed_configured: boolean;
  gold_rate_ttl_minutes: number;
  gold_rate: GoldRate | null;
}

export interface PublicVerification {
  jewellery_id: string;
  title: string;
  store: StoreRef;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  photos: Photo[];
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
  verification_level: VerificationLevel;
  /** Only what the level vouches for: HUID from Hallmark linked up, certificate for Lab verified. */
  huid: string | null;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  stock_status: StockStatus;
  record_status: "ACTIVE";
  registered_on: string;
  gold_rate: GoldRate | null;
  price: PiecePrice;
}
```

- [ ] **Step 2: Add the services**

Create `frontend/src/services/photos.ts`:

```ts
import { apiUrl, request, requestBlob } from "./api";
import type { Photo, PhotoOwner } from "@/types";

export type PhotoSize = "full" | "thumb";

const ownerPath = (owner: PhotoOwner, key: string) => `/api/${owner}/${encodeURIComponent(key)}/photos`;
const photoPath = (id: string) => `/api/photos/${encodeURIComponent(id)}`;

/** Every change returns the owner's photos in their new order. */
export const photoService = {
  upload: (owner: PhotoOwner, key: string, file: File, altText = "") => {
    const form = new FormData();
    form.append("file", file);
    form.append("alt_text", altText);
    return request<Photo[]>(ownerPath(owner, key), { method: "POST", body: form });
  },
  reorder: (owner: PhotoOwner, key: string, photoIds: string[]) =>
    request<Photo[]>(`${ownerPath(owner, key)}/order`, { method: "PUT", body: { photo_ids: photoIds } }),
  updateAlt: (id: string, altText: string) => request<Photo[]>(photoPath(id), { method: "PUT", body: { alt_text: altText } }),
  remove: (id: string) => request<Photo[]>(photoPath(id), { method: "DELETE" }),
  /** Signed-in fetch, so admins also see photos of drafts. */
  blob: (id: string, size: PhotoSize) => requestBlob(`${photoPath(id)}/${size}`),
  /** Plain URL for photos buyers can see. */
  url: (id: string, size: PhotoSize) => apiUrl(`${photoPath(id)}/${size}`),
};
```

Create `frontend/src/services/stores.ts`:

```ts
import { request } from "./api";
import type { Store, StoreInput } from "@/types";

const base = "/api/stores";
const one = (slug: string) => `${base}/${encodeURIComponent(slug)}`;

export const storeService = {
  list: () => request<Store[]>(base),
  get: (slug: string) => request<Store>(one(slug)),
  create: (data: StoreInput) => request<Store>(base, { method: "POST", body: data }),
  update: (slug: string, data: StoreInput) => request<Store>(one(slug), { method: "PUT", body: data }),
  remove: (slug: string) => request<void>(one(slug), { method: "DELETE" }),
  activate: (slug: string) => request<Store>(`${one(slug)}/activate`, { method: "POST" }),
  deactivate: (slug: string) => request<Store>(`${one(slug)}/deactivate`, { method: "POST" }),
};
```

Create `frontend/src/services/designs.ts`:

```ts
import { request } from "./api";
import type { Design, DesignInput } from "@/types";

const base = "/api/designs";
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const designService = {
  list: (query: { store?: string; published?: "true" | "false" | "" } = {}) =>
    request<Design[]>(base, { query: { ...query } }),
  get: (id: string) => request<Design>(one(id)),
  create: (data: DesignInput) => request<Design>(base, { method: "POST", body: data }),
  update: (id: string, data: DesignInput) => request<Design>(one(id), { method: "PUT", body: data }),
  remove: (id: string) => request<void>(one(id), { method: "DELETE" }),
};
```

In `frontend/src/services/jewellery.ts`, change the type import to `import type { Jewellery, JewelleryInput, JewelleryQuery, JewelleryStats, Page, PiecePrice, PricePreviewInput } from "@/types";`, delete `uploadPhoto`, `photo` and `removePhoto`, and add after `activate`:

```ts
  pricePreview: (data: PricePreviewInput, signal?: AbortSignal) =>
    request<PiecePrice>(`${base}/price-preview`, { method: "POST", body: data, signal }),
```

Replace `frontend/src/services/verify.ts` with:

```ts
import { request } from "./api";
import type { PublicVerification } from "@/types";

const path = (code: string) => `/api/verify/${encodeURIComponent(code.trim())}`;

export const verifyService = {
  verify: (code: string, signal?: AbortSignal) => request<PublicVerification>(path(code), { auth: false, signal }),
};
```

In `frontend/src/services/settings.ts`, change the `update` parameter type to `data: { gst_percent: string }`.

- [ ] **Step 3: Add `formatDateTime`**

Append to `frontend/src/utils/format.ts`:

```ts
/** 11 Oct 2026, 10:30 am */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
```

- [ ] **Step 4: Check the new files compile**

Run: `cd frontend && npx tsc -b 2>&1 | grep -E "src/(types|services|utils)/" ; echo "exit: done"`
Expected: no lines mentioning `src/types`, `src/services` or `src/utils` (errors in pages are expected until Task 13).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services frontend/src/utils/format.ts
git commit -m "Add frontend types and services for stores, designs and photos"
```

---

### Task 9: Admin photo manager

**Files:**
- Create: `frontend/src/hooks/useAdminImage.ts`, `frontend/src/components/photos/PhotoManager.tsx`
- Delete: `frontend/src/hooks/usePhoto.ts`, `frontend/src/components/jewellery/PhotoUpload.tsx`

**Interfaces:**
- Consumes: `photoService`, `PhotoSize` (Task 8); `Button`, `ConfirmDialog`, `Input`.
- Produces: `useAdminImage(publicId?: string, size?: PhotoSize): string | null`; `<PhotoManager owner ownerKey photos onChange hint? />` and `MAX_PHOTOS = 6`.

- [ ] **Step 1: Add the image hook**

Create `frontend/src/hooks/useAdminImage.ts`:

```ts
import { useEffect, useState } from "react";
import { photoService, type PhotoSize } from "@/services/photos";

/** Object URL for a photo fetched with the admin's token, so drafts' photos show too. Null while loading or on error. */
export function useAdminImage(publicId: string | undefined, size: PhotoSize = "thumb") {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!publicId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    photoService
      .blob(publicId, size)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* the page still renders without the image */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [publicId, size]);

  return url;
}
```

- [ ] **Step 2: Add the photo manager**

Create `frontend/src/components/photos/PhotoManager.tsx`:

```tsx
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useAdminImage } from "@/hooks/useAdminImage";
import { errorMessage } from "@/services/api";
import { photoService } from "@/services/photos";
import type { Photo, PhotoOwner } from "@/types";

export const MAX_PHOTOS = 6;

interface PhotoManagerProps {
  owner: PhotoOwner;
  /** Store slug, Jewellery ID or design ID. */
  ownerKey: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  hint?: string;
}

function Thumb({ photo }: { photo: Photo }) {
  const url = useAdminImage(photo.public_id, "thumb");
  return url ? (
    <img src={url} alt={photo.alt} className="aspect-square w-full rounded-md border border-line object-cover" />
  ) : (
    <div className="aspect-square w-full animate-pulse rounded-md bg-basalt-50" aria-hidden />
  );
}

/** Upload, order, describe and delete up to six photos. The first photo is the cover. */
export function PhotoManager({ owner, ownerKey, photos, onChange, hint }: PhotoManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<Photo[]>, success?: string) {
    setBusy(true);
    try {
      onChange(await action());
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = photos.map((p) => p.public_id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void run(() => photoService.reorder(owner, ownerKey, ids));
  }

  async function upload(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, MAX_PHOTOS - photos.length);
    for (const file of picked) {
      await run(() => photoService.upload(owner, ownerKey, file));
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-4">
      {hint && <p className="text-[13px] leading-relaxed text-muted">{hint}</p>}

      {photos.length > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.public_id} className="space-y-2 rounded-md border border-line p-3">
              <Thumb photo={photo} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{i === 0 ? "Cover photo" : `Photo ${i + 1}`}</span>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label={`Move photo ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Move photo ${i + 1} later`} disabled={busy || i === photos.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <ConfirmDialog
                    title="Delete this photo?"
                    description="It's removed straight away, everywhere it appears."
                    confirmLabel="Delete photo"
                    onConfirm={() => run(() => photoService.remove(photo.public_id), "Photo deleted.")}
                    trigger={
                      <Button size="icon" variant="ghost" aria-label={`Delete photo ${i + 1}`} disabled={busy}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </div>
              <Input
                aria-label={`Alt text for photo ${i + 1}`}
                placeholder={`Alt text (default: ${photo.alt})`}
                defaultValue={photo.alt_text}
                maxLength={200}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value !== photo.alt_text) void run(() => photoService.updateAlt(photo.public_id, value));
                }}
              />
            </li>
          ))}
        </ol>
      )}

      {photos.length < MAX_PHOTOS && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void upload(e.target.files)}
          />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <ImagePlus /> Add photos
          </Button>
          <span className="text-xs text-muted">
            JPG or PNG, up to 4 MB each · {MAX_PHOTOS - photos.length} more allowed
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remove the single-photo pieces**

Run: `cd frontend && git rm src/hooks/usePhoto.ts src/components/jewellery/PhotoUpload.tsx`

(Their users are updated in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useAdminImage.ts frontend/src/components/photos/PhotoManager.tsx
git commit -m "Add the admin photo manager"
```

---

### Task 10: Stores admin

**Files:**
- Create: `frontend/src/hooks/useStores.ts`, `frontend/src/components/stores/storeSchema.ts`, `frontend/src/pages/admin/StoreListPage.tsx`, `frontend/src/pages/admin/StoreFormPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/layout/AdminLayout.tsx`

**Interfaces:**
- Consumes: `storeService`, `PhotoManager`, `Store`, `StoreInput`, UI primitives, `StatusBadge`.
- Produces: `useStores(): { stores: Store[] | null; setStores; error: string | null; reload }`; routes `/admin/stores`, `/admin/stores/new`, `/admin/stores/:slug/edit`; the new admin navigation (also lists Designs, whose pages arrive in Task 12).

- [ ] **Step 1: Add the hook and form schema**

Create `frontend/src/hooks/useStores.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

export function useStores() {
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    storeService
      .list()
      .then(setStores)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);
  return { stores, setStores, error, reload: load };
}
```

Create `frontend/src/components/stores/storeSchema.ts`:

```ts
import { z } from "zod";
import type { Store, StoreInput } from "@/types";

const phone = z
  .string()
  .trim()
  .refine((v) => !v || /^\+?\d{8,15}$/.test(v.replace(/[\s\-().]/g, "")), "Use 8 to 15 digits, optionally starting with +");

const coordinate = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v) && Math.abs(Number(v)) <= limit, `A number between -${limit} and ${limit}`);

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Enter the store name").max(120, "Keep it under 120 characters"),
  slug: z
    .string()
    .trim()
    .max(80, "Keep it under 80 characters")
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Lower-case letters, numbers and single hyphens"),
  address: z.string().trim().min(5, "Enter the full address").max(500, "Keep it under 500 characters"),
  area: z.string().trim().min(2, "Enter the area").max(80, "Keep it under 80 characters"),
  city: z.string().trim().min(2, "Enter the city").max(80, "Keep it under 80 characters"),
  latitude: coordinate("latitude", 90),
  longitude: coordinate("longitude", 180),
  phone,
  whatsapp: phone,
  hours: z.string().trim().min(2, "Enter the opening hours").max(200, "Keep it under 200 characters"),
});

export type StoreFormValues = z.infer<typeof storeSchema>;

export const emptyStore: StoreFormValues = {
  name: "",
  slug: "",
  address: "",
  area: "",
  city: "",
  latitude: "",
  longitude: "",
  phone: "",
  whatsapp: "",
  hours: "",
};

export function storeToForm(s: Store): StoreFormValues {
  return {
    name: s.name,
    slug: s.slug,
    address: s.address,
    area: s.area,
    city: s.city,
    latitude: String(Number(s.latitude)),
    longitude: String(Number(s.longitude)),
    phone: s.phone ?? "",
    whatsapp: s.whatsapp ?? "",
    hours: s.hours,
  };
}

export function storeToInput(v: StoreFormValues): StoreInput {
  return { ...v, slug: v.slug || null, phone: v.phone || null, whatsapp: v.whatsapp || null };
}
```

- [ ] **Step 2: Add the list page**

Create `frontend/src/pages/admin/StoreListPage.tsx`:

```tsx
import { PencilLine, Plus, Power, PowerOff, Store as StoreIcon, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/components/jewellery/StatusBadge";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

const iconLink = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-basalt-50 hover:text-basalt";

export function StoreListPage() {
  const { stores, setStores, error, reload } = useStores();

  useEffect(() => {
    document.title = "Stores";
  }, []);

  function replace(updated: Store) {
    setStores((all) => all && all.map((s) => (s.slug === updated.slug ? updated : s)));
  }

  async function toggle(store: Store) {
    try {
      const active = store.status === "active";
      replace(active ? await storeService.deactivate(store.slug) : await storeService.activate(store.slug));
      toast.success(active ? `${store.name} is hidden from buyers.` : `${store.name} is visible to buyers again.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(store: Store) {
    try {
      await storeService.remove(store.slug);
      setStores((all) => all && all.filter((s) => s.slug !== store.slug));
      toast.success(`${store.name} deleted.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const addButton = (
    <Link to="/admin/stores/new" className={buttonVariants({ size: "lg" })}>
      <Plus /> Add store
    </Link>
  );

  return (
    <>
      <PageHeader title="Stores" description="The shops whose pieces and designs buyers can browse." actions={addButton} />
      <Panel>
        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : stores === null ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <EmptyState icon={StoreIcon} title="No stores yet" description="Add a store, then add its pieces and designs." action={addButton} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Store</th>
                  <th className="px-5 py-3 text-right font-medium">Pieces</th>
                  <th className="px-5 py-3 text-right font-medium">Designs</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stores.map((store) => (
                  <tr key={store.slug}>
                    <td className="px-5 py-3">
                      <Link to={`/admin/stores/${store.slug}/edit`} className="font-medium text-basalt hover:underline">
                        {store.name}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {store.area}, {store.city}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3 text-right">{store.piece_count}</td>
                    <td className="tabular px-5 py-3 text-right">{store.design_count}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={store.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/admin/stores/${store.slug}/edit`} className={iconLink} aria-label={`Edit ${store.name}`} title="Edit">
                          <PencilLine className="size-4" />
                        </Link>
                        <ConfirmDialog
                          title={store.status === "active" ? `Hide ${store.name}?` : `Show ${store.name} again?`}
                          description={
                            store.status === "active"
                              ? "Buyers stop seeing its pieces and designs, and its QR codes say the record is no longer active."
                              : "Its published pieces and designs become visible to buyers again."
                          }
                          confirmLabel={store.status === "active" ? "Deactivate" : "Reactivate"}
                          tone={store.status === "active" ? "danger" : "primary"}
                          onConfirm={() => toggle(store)}
                          trigger={
                            <button type="button" className={iconLink} aria-label={`${store.status === "active" ? "Deactivate" : "Reactivate"} ${store.name}`}>
                              {store.status === "active" ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            </button>
                          }
                        />
                        {store.piece_count + store.design_count === 0 && (
                          <ConfirmDialog
                            title={`Delete ${store.name}?`}
                            description="The store and its photos are removed permanently."
                            confirmLabel="Delete store"
                            onConfirm={() => remove(store)}
                            trigger={
                              <button type="button" className={iconLink} aria-label={`Delete ${store.name}`}>
                                <Trash2 className="size-4" />
                              </button>
                            }
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
```

- [ ] **Step 3: Add the form page**

Create `frontend/src/pages/admin/StoreFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AdminLayout";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { emptyStore, storeSchema, storeToForm, storeToInput, type StoreFormValues } from "@/components/stores/storeSchema";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

const back = (
  <Link to="/admin/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All stores
  </Link>
);

/** Add a store (/admin/stores/new) or edit one (/admin/stores/:slug/edit). Photos can be added once it's saved. */
export function StoreFormPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormValues>({ resolver: zodResolver(storeSchema), defaultValues: emptyStore, mode: "onTouched" });
  const [lat, lng] = useWatch({ control, name: ["latitude", "longitude"] });

  useEffect(() => {
    document.title = slug ? "Edit store" : "Add store";
    if (!slug) return;
    storeService
      .get(slug)
      .then((s) => {
        setStore(s);
        reset(storeToForm(s));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [slug, reset]);

  async function onSubmit(values: StoreFormValues) {
    try {
      const saved = slug ? await storeService.update(slug, storeToInput(values)) : await storeService.create(storeToInput(values));
      toast.success(slug ? "Store saved." : "Store added. You can add its photos now.");
      if (saved.slug !== slug) navigate(`/admin/stores/${saved.slug}/edit`, { replace: true });
      else {
        setStore(saved);
        reset(storeToForm(saved));
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in storeSchema.shape) setError(field as keyof StoreFormValues, { message });
        }
      }
      toast.error(errorMessage(err, "The store could not be saved. Try again."));
    }
  }

  if (loadError) {
    return (
      <>
        {back}
        <Panel className="p-8 text-center text-sm text-danger">{loadError}</Panel>
      </>
    );
  }

  const mapUrl = /^-?\d+(\.\d+)?$/.test(lat) && /^-?\d+(\.\d+)?$/.test(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const digits = { inputMode: "tel" as const, autoComplete: "off" };

  return (
    <>
      <PageHeader
        back={back}
        title={slug ? (store ? store.name : <Skeleton className="h-9 w-64" />) : "Add store"}
        description={slug ? "Changes show to buyers straight away." : "Save the store first; then you can add its photos."}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Store details" />
          <form onSubmit={handleSubmit(onSubmit, () => toast.error("Check the highlighted fields."))} noValidate className="space-y-5 p-5 sm:p-6">
            <Field label="Store name" error={errors.name?.message}>
              <Input autoComplete="organization" {...register("name")} />
            </Field>
            <Field label="Web address" optional error={errors.slug?.message} hint="Used in the store's link. Leave blank to make one from the name.">
              <Input autoComplete="off" placeholder="e.g. shree-ganesh-jewellers" {...register("slug")} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Textarea rows={2} {...register("address")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Area" error={errors.area?.message} hint="e.g. Zaveri Bazaar">
                <Input {...register("area")} />
              </Field>
              <Field label="City" error={errors.city?.message}>
                <Input autoComplete="address-level2" {...register("city")} />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <Input inputMode="decimal" placeholder="18.951700" {...register("latitude")} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <Input inputMode="decimal" placeholder="72.833100" {...register("longitude")} />
                </Field>
              </div>
              <p className="text-[13px] text-muted">
                In Google Maps, right-click the shop and click the coordinates to copy them.{" "}
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-basalt hover:underline">
                    Check on map <ExternalLink className="size-3.5" />
                  </a>
                )}
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" optional error={errors.phone?.message} hint="Buyers get a call button.">
                <Input {...digits} placeholder="+91 22 2345 6789" {...register("phone")} />
              </Field>
              <Field label="WhatsApp" optional error={errors.whatsapp?.message} hint="Buyers get a WhatsApp button.">
                <Input {...digits} placeholder="+91 98200 12345" {...register("whatsapp")} />
              </Field>
            </div>
            <Field label="Opening hours" error={errors.hours?.message} hint="e.g. Mon–Sat 10:30 am – 8:30 pm, closed Sunday">
              <Input {...register("hours")} />
            </Field>
            <Button type="submit" loading={isSubmitting}>
              {slug ? "Save store" : "Add store"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Photos" description="Shopfront and inside the store." />
          <div className="p-5 sm:p-6">
            {store ? (
              <PhotoManager owner="stores" ownerKey={store.slug} photos={store.photos} onChange={(photos) => setStore({ ...store, photos })} />
            ) : (
              <p className="text-[13px] text-muted">{slug ? "Loading…" : "Save the store first, then add its photos here."}</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Add the routes and navigation**

In `frontend/src/App.tsx`, add the lazy page imports next to the others:

```tsx
const StoreListPage = named(() => import("@/pages/admin/StoreListPage"), "StoreListPage");
const StoreFormPage = named(() => import("@/pages/admin/StoreFormPage"), "StoreFormPage");
```

and add inside the admin layout, after the `jewellery/:id/edit` route:

```tsx
                <Route path="stores" element={<StoreListPage />} />
                <Route path="stores/new" element={<StoreFormPage />} />
                <Route path="stores/:slug/edit" element={<StoreFormPage />} />
```

In `frontend/src/components/layout/AdminLayout.tsx`, change the lucide import to `import { Gem, LayoutDashboard, LogOut, Menu, Palette, Plus, Settings, Store, Users, X } from "lucide-react";` and replace `NAV` with:

```tsx
const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/stores", label: "Stores", icon: Store, end: false },
  { to: "/admin/jewellery", label: "Pieces", icon: Gem, end: true },
  { to: "/admin/jewellery/new", label: "Add piece", icon: Plus, end: true },
  { to: "/admin/designs", label: "Designs", icon: Palette, end: false },
  { to: "/admin/team", label: "Team", icon: Users, end: true },
  { to: "/admin/settings", label: "Store settings", icon: Settings, end: true },
];
```

(The `Gem` icon is replaced along with the rest of the diamond graphics in Part 4. The Designs link leads to the not-found page until Task 12 adds its routes.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useStores.ts frontend/src/components/stores frontend/src/pages/admin/StoreListPage.tsx frontend/src/pages/admin/StoreFormPage.tsx frontend/src/App.tsx frontend/src/components/layout/AdminLayout.tsx
git commit -m "Add store management to the admin"
```

---

### Task 11: Pieces admin

**Files:**
- Modify: `frontend/src/components/jewellery/jewellerySchema.ts`, `JewelleryForm.tsx`, `JewelleryTable.tsx`, `StatusBadge.tsx`
- Create: `frontend/src/components/jewellery/DiscountPreview.tsx`, `frontend/src/components/jewellery/savePiece.ts`
- Modify: `frontend/src/pages/admin/AddJewelleryPage.tsx`, `EditJewelleryPage.tsx`, `JewelleryDetailPage.tsx`, `JewelleryListPage.tsx`, `DashboardPage.tsx`, `SettingsPage.tsx`

**Interfaces:**
- Consumes: types and services (Task 8), `PhotoManager` (Task 9), `useStores` (Task 10), `PriceBreakdown` with the `price` prop (rewritten in Task 13; until then the detail page's use of it is the only type error left).
- Produces: `LevelBadge({ level })`, `ListingBadge({ published, stock })` in `StatusBadge.tsx` (replacing `VerificationBadge`); `toPreviewInput(values) -> PricePreviewInput | null`; `savePiece(id, input, certificate, hasDocument) -> Promise<{ item: Jewellery; warning: string | null }>`; `<DiscountPreview input />`; `JewelleryForm` props `canPublish` and `onSubmit(input, certificate)`.

- [ ] **Step 1: Badges**

Replace `frontend/src/components/jewellery/StatusBadge.tsx` with:

```tsx
import { STOCK_LABEL, VERIFICATION_LABEL, type RecordStatus, type StockStatus, type VerificationLevel } from "@/types";
import { cn } from "@/utils/cn";

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function StatusBadge({ status, className }: { status: RecordStatus; className?: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        base,
        active ? "border-basalt/20 bg-basalt-50 text-basalt" : "border-line-strong bg-chalk text-muted",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-basalt" : "bg-muted/60")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** The verification level, worded exactly as buyers see it. */
export function LevelBadge({ level, className }: { level: VerificationLevel; className?: string }) {
  return (
    <span
      className={cn(
        base,
        level === "lab" && "border-gold/40 bg-gold-soft text-[#7a5f35]",
        level === "hallmark" && "border-basalt/20 bg-basalt-50 text-basalt",
        level === "declared" && "border-line-strong bg-white text-ink",
        className,
      )}
    >
      {VERIFICATION_LABEL[level]}
    </span>
  );
}

/** "Draft" until published; then the stock status. */
export function ListingBadge({ published, stock, className }: { published: boolean; stock: StockStatus; className?: string }) {
  if (!published) return <span className={cn(base, "border-dashed border-line-strong bg-white text-muted", className)}>Draft</span>;
  return (
    <span className={cn(base, stock === "in_stock" ? "border-verified/30 bg-white text-verified" : "border-line-strong bg-chalk text-muted", className)}>
      {STOCK_LABEL[stock]}
    </span>
  );
}
```

- [ ] **Step 2: Form schema**

Replace `frontend/src/components/jewellery/jewellerySchema.ts` with:

```ts
import { z } from "zod";
import {
  GOLD_COLOURS,
  JEWELLERY_TYPES,
  PURITIES,
  STOCK_STATUSES,
  VERIFICATION_LEVELS,
  type DiscountType,
  type Jewellery,
  type JewelleryInput,
  type PricePreviewInput,
} from "@/types";
import { sumMoney } from "@/utils/format";

const weight = z
  .string()
  .trim()
  .min(1, "Enter a weight")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number with up to 3 decimals, e.g. 15.42")
  .refine((v) => Number(v) > 0, "Weight must be more than 0");

const money = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimals, without commas");

const optionalMoney = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d{1,2})?)?$/, "Use a number with up to 2 decimals, without commas");

const optionalPercent = z
  .string()
  .trim()
  .regex(/^(\d{1,3}(\.\d{1,2})?)?$/, "Use a percentage with up to 2 decimals, e.g. 12.5")
  .refine((v) => !v || Number(v) <= 100, "Must be 100% or less");

const today = () => new Date().toISOString().slice(0, 10);

export const jewellerySchema = z
  .object({
    store: z.string().min(1, "Choose the store"),
    title: z.string().trim().min(2, "Give the piece a short title").max(120, "Keep it under 120 characters"),
    type: z.enum(JEWELLERY_TYPES, { message: "Choose a category" }),
    description: z.string().trim().min(3, "Describe the piece in a few words").max(500, "Keep it under 500 characters"),
    colour: z.union([z.enum(GOLD_COLOURS), z.literal("")]),
    design_details: z.string().trim().max(1000, "Keep it under 1000 characters"),
    purity: z.enum(PURITIES, { message: "Choose the purity" }),
    gross_weight: weight,
    net_weight: weight,
    verification_level: z.enum(VERIFICATION_LEVELS),
    huid: z.string().trim().regex(/^([A-Za-z0-9]{6})?$/, "A HUID is 6 letters or digits"),
    certificate_id: z
      .string()
      .trim()
      .max(64, "Keep it under 64 characters")
      .regex(/^([A-Za-z0-9][A-Za-z0-9\-/._]*)?$/, "Use letters, numbers, - / . or _"),
    issuing_authority: z.string().trim().max(160, "Keep it under 160 characters"),
    certificate_date: z.string().refine((v) => !v || v <= today(), "Date can't be in the future"),
    gold_value: money("gold value"),
    making_charges: money("making charges"),
    other_component_value: optionalMoney,
    tax: money("tax"),
    manual_total: z.boolean(),
    total_price: optionalMoney,
    making_percent_min: optionalPercent,
    making_percent_max: optionalPercent,
    stock_status: z.enum(STOCK_STATUSES),
    is_published: z.boolean(),
    discount_type: z.enum(["", "percent", "flat"]),
    discount_value: optionalMoney,
    discount_ends_on: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (Number(v.net_weight) > Number(v.gross_weight)) issue("net_weight", "Net gold weight can't exceed gross weight");
    if (!v.certificate_id && (v.issuing_authority || v.certificate_date)) issue("certificate_id", "Add the certificate ID for these details");
    if (Boolean(v.making_percent_min) !== Boolean(v.making_percent_max)) {
      issue(v.making_percent_min ? "making_percent_max" : "making_percent_min", "Enter both ends of the range, or neither");
    } else if (v.making_percent_min && Number(v.making_percent_min) > Number(v.making_percent_max)) {
      issue("making_percent_max", "Can't be below the minimum");
    }
    if (v.manual_total && !v.total_price) issue("total_price", "Enter the corrected total");
    if (v.verification_level === "hallmark" && !v.huid) issue("huid", "Enter the piece's 6-character HUID");
    if (v.verification_level === "lab" && !(v.certificate_id && v.issuing_authority && v.certificate_date)) {
      issue("verification_level", "Lab verified needs the certificate ID, issuing authority and date");
    }
    if (v.discount_type) {
      const value = Number(v.discount_value);
      const registered = v.manual_total && v.total_price ? Number(v.total_price) : sumMoney(v.gold_value, v.making_charges, v.other_component_value, v.tax);
      if (!v.discount_value) issue("discount_value", "Enter the discount");
      else if (v.discount_type === "percent" && (value < 1 || value > 90)) issue("discount_value", "Between 1 and 90");
      else if (v.discount_type === "flat" && (value <= 0 || value >= registered)) issue("discount_value", "Must be above ₹0 and below the registered price");
    }
  });

export type JewelleryFormValues = z.infer<typeof jewellerySchema>;

export const emptyValues: JewelleryFormValues = {
  store: "",
  title: "",
  type: "" as JewelleryFormValues["type"],
  description: "",
  colour: "",
  design_details: "",
  purity: "22K",
  gross_weight: "",
  net_weight: "",
  verification_level: "declared",
  huid: "",
  certificate_id: "",
  issuing_authority: "",
  certificate_date: "",
  gold_value: "",
  making_charges: "",
  other_component_value: "",
  tax: "",
  manual_total: false,
  total_price: "",
  making_percent_min: "",
  making_percent_max: "",
  stock_status: "in_stock",
  is_published: false,
  discount_type: "",
  discount_value: "",
  discount_ends_on: "",
};

/** Strip API decimals like "98500.00" to "98500" for editing. */
const plain = (v: string) => String(Number(v));

export function toFormValues(item: Jewellery): JewelleryFormValues {
  const calculated = sumMoney(item.gold_value, item.making_charges, item.other_component_value, item.tax);
  const manual = Math.abs(calculated - Number(item.total_price)) >= 0.01;
  return {
    store: item.store.slug,
    title: item.title,
    type: item.type,
    description: item.description,
    colour: item.colour ?? "",
    design_details: item.design_details ?? "",
    purity: item.purity,
    gross_weight: plain(item.gross_weight),
    net_weight: plain(item.net_weight),
    verification_level: item.verification_level,
    huid: item.huid ?? "",
    certificate_id: item.certificate_id ?? "",
    issuing_authority: item.issuing_authority ?? "",
    certificate_date: item.certificate_date ?? "",
    gold_value: plain(item.gold_value),
    making_charges: plain(item.making_charges),
    other_component_value: plain(item.other_component_value),
    tax: plain(item.tax),
    manual_total: manual,
    total_price: manual ? plain(item.total_price) : "",
    making_percent_min: item.making_percent_min === null ? "" : plain(item.making_percent_min),
    making_percent_max: item.making_percent_max === null ? "" : plain(item.making_percent_max),
    stock_status: item.stock_status,
    is_published: item.is_published,
    discount_type: item.discount_type ?? "",
    discount_value: item.discount_value === null ? "" : plain(item.discount_value),
    discount_ends_on: item.discount_ends_on ?? "",
  };
}

export function toInput(v: JewelleryFormValues): JewelleryInput {
  const discounted = Boolean(v.discount_type);
  return {
    store: v.store,
    title: v.title,
    type: v.type,
    description: v.description,
    colour: v.colour || null,
    design_details: v.design_details || null,
    purity: v.purity,
    gross_weight: v.gross_weight,
    net_weight: v.net_weight,
    verification_level: v.verification_level,
    huid: v.huid ? v.huid.toUpperCase() : null,
    certificate_id: v.certificate_id || null,
    issuing_authority: v.issuing_authority || null,
    certificate_date: v.certificate_date || null,
    gold_value: v.gold_value,
    making_charges: v.making_charges,
    other_component_value: v.other_component_value || "0",
    tax: v.tax,
    total_price: v.manual_total ? v.total_price : null,
    making_percent_min: v.making_percent_min || null,
    making_percent_max: v.making_percent_max || null,
    stock_status: v.stock_status,
    is_published: v.is_published,
    discount_type: discounted ? (v.discount_type as DiscountType) : null,
    discount_value: discounted ? v.discount_value : null,
    discount_ends_on: discounted && v.discount_ends_on ? v.discount_ends_on : null,
  };
}

const isNumber = (s: string | undefined) => /^\d+(\.\d+)?$/.test((s ?? "").trim());

/** The figures for a price preview, or null while the form doesn't have enough to price the piece. */
export function toPreviewInput(v: JewelleryFormValues): PricePreviewInput | null {
  if (![v.net_weight, v.gold_value, v.making_charges, v.tax].every(isNumber) || Number(v.net_weight) <= 0) return null;
  if (v.other_component_value && !isNumber(v.other_component_value)) return null;
  const ranged = isNumber(v.making_percent_min) && isNumber(v.making_percent_max);
  const discounted = Boolean(v.discount_type) && isNumber(v.discount_value);
  return {
    purity: v.purity,
    net_weight: v.net_weight.trim(),
    gold_value: v.gold_value.trim(),
    making_charges: v.making_charges.trim(),
    other_component_value: v.other_component_value.trim() || "0",
    tax: v.tax.trim(),
    making_percent_min: ranged ? v.making_percent_min.trim() : null,
    making_percent_max: ranged ? v.making_percent_max.trim() : null,
    discount_type: discounted ? (v.discount_type as DiscountType) : null,
    discount_value: discounted ? v.discount_value.trim() : null,
    discount_ends_on: discounted && v.discount_ends_on ? v.discount_ends_on : null,
    stock_status: v.stock_status,
  };
}
```

- [ ] **Step 3: Discount preview and save helper**

Create `frontend/src/components/jewellery/DiscountPreview.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { jewelleryService } from "@/services/jewellery";
import type { PiecePrice, PricePreviewInput } from "@/types";
import { formatINRRange } from "@/utils/format";

/** What buyers would see, priced by the server so it matches the QR page exactly. */
export function DiscountPreview({ input }: { input: PricePreviewInput | null }) {
  const key = useDebounce(input ? JSON.stringify(input) : "", 400);
  const [price, setPrice] = useState<PiecePrice | null>(null);

  useEffect(() => {
    if (!key) {
      setPrice(null);
      return;
    }
    const controller = new AbortController();
    jewelleryService
      .pricePreview(JSON.parse(key) as PricePreviewInput, controller.signal)
      .then(setPrice)
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setPrice(null);
      });
    return () => controller.abort();
  }, [key]);

  return (
    <div className="rounded-md border border-line bg-chalk p-4" aria-live="polite">
      {price ? (
        <>
          <p className="text-[13px] text-muted">
            {price.basis === "live" ? "Buyers see today, at the live gold rate:" : "Buyers see (no live gold rate yet, so the registered price):"}
          </p>
          {price.discount && (
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">{price.discount.label}</span>
            </p>
          )}
          <p className="tabular mt-1 text-xl font-semibold text-basalt">{formatINRRange(price.final_min, price.final_max)}</p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Fill in the weight and prices to preview what buyers will see.</p>
      )}
    </div>
  );
}
```

Create `frontend/src/components/jewellery/savePiece.ts`:

```ts
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import type { Jewellery, JewelleryInput } from "@/types";

/**
 * Save a piece and its certificate file. Lab verified needs the file on record first, so when a new
 * file arrives with that level the piece is saved as "declared", the file uploaded, then the level set.
 */
export async function savePiece(
  id: string | null,
  input: JewelleryInput,
  certificate: File | null,
  hasDocument: boolean,
): Promise<{ item: Jewellery; warning: string | null }> {
  const fileFirst = input.verification_level === "lab" && certificate !== null && !hasDocument;
  const first = fileFirst ? { ...input, verification_level: "declared" as const } : input;
  let item = id ? await jewelleryService.update(id, first) : await jewelleryService.create(first);

  if (certificate) {
    try {
      item = await jewelleryService.uploadCertificate(item.jewellery_id, certificate);
    } catch (err) {
      const then = fileFirst ? ", then choose Lab verified" : "";
      return { item, warning: `Saved, but the certificate didn't upload: ${errorMessage(err)} Add it from Edit${then}.` };
    }
  }
  if (fileFirst) item = await jewelleryService.update(item.jewellery_id, input);
  return { item, warning: null };
}
```

- [ ] **Step 4: The form**

In `frontend/src/components/jewellery/JewelleryForm.tsx`:

a) Replace the imports and props with:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, PencilLine } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { useStores } from "@/hooks/useStores";
import { ApiError } from "@/services/api";
import {
  GOLD_COLOURS,
  JEWELLERY_TYPES,
  PURITIES,
  PURITY_PERCENT,
  STOCK_LABEL,
  STOCK_STATUSES,
  VERIFICATION_LABEL,
  VERIFICATION_LEVELS,
  type JewelleryInput,
  type VerificationLevel,
} from "@/types";
import { formatINR, formatINRRange, sumMoney } from "@/utils/format";
import { CertificateUpload } from "./CertificateUpload";
import { DiscountPreview } from "./DiscountPreview";
import { emptyValues, jewellerySchema, toInput, toPreviewInput, type JewelleryFormValues } from "./jewellerySchema";

const LEVEL_HINT: Record<VerificationLevel, string> = {
  declared: "The store's own description. Buyers are told no hallmark or certificate is linked.",
  hallmark: "Linked to the piece's BIS hallmark. Buyers see the HUID.",
  lab: "Backed by a lab certificate. Buyers see its ID, issuer and date. The certificate file must be attached.",
};

interface JewelleryFormProps {
  defaultValues?: JewelleryFormValues;
  submitLabel: string;
  cancelTo: string;
  existingDocument?: { onDownload: () => void; onRemove: () => void } | null;
  /** Publishing needs a photo, and photos are added on the record page once the piece is saved. */
  canPublish: boolean;
  onSubmit: (input: JewelleryInput, certificate: File | null) => Promise<void>;
}
```

b) Replace the start of the component, from `export function JewelleryForm(` down to and including the `rangeExample` constant, with:

```tsx
export function JewelleryForm({ defaultValues = emptyValues, submitLabel, cancelTo, existingDocument, canPublish, onSubmit }: JewelleryFormProps) {
  const [certificate, setCertificate] = useState<File | null>(null);
  const { stores } = useStores();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JewelleryFormValues>({ resolver: zodResolver(jewellerySchema), defaultValues, mode: "onTouched" });

  const values = useWatch({ control }) as JewelleryFormValues;
  const { gold_value: gold, making_charges: making, other_component_value: other, tax, manual_total: manual, purity } = values;
  const { making_percent_min: makingMin, making_percent_max: makingMax, verification_level: level, discount_type: discountType } = values;

  // With a single store there's nothing to choose.
  useEffect(() => {
    if (stores?.length === 1 && !getValues("store")) setValue("store", stores[0].slug);
  }, [stores, getValues, setValue]);

  const calculated = sumMoney(gold, making, other, tax);
  const rangeExample =
    Number(gold) > 0 && makingMin && makingMax
      ? formatINRRange(Math.round((Number(gold) * Number(makingMin)) / 100), Math.round((Number(gold) * Number(makingMax)) / 100))
      : null;
```

c) In `submit`, change `await onSubmit(toInput(values), certificate, photo);` to `await onSubmit(toInput(values), certificate);`.

d) Replace Section 1 (`<Section step={1} ...>` to its closing tag) with:

```tsx
      <Section step={1} title="Basic information" description="What the piece is and which store sells it.">
        <Field label="Store" error={errors.store?.message}>
          <Select {...register("store")} disabled={!stores}>
            <option value="" disabled>
              {stores ? "Choose a store" : "Loading stores…"}
            </option>
            {stores?.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.area})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" error={errors.title?.message} hint="Short, as buyers would say it: Nakshi kada, Temple necklace">
          <Input maxLength={120} {...register("title")} />
        </Field>
        <Field label="Category" error={errors.type?.message}>
          <Select {...register("type")}>
            <option value="" disabled>
              Choose a category
            </option>
            {JEWELLERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" error={errors.description?.message} hint="For example: 22K gold ring with a 0.30 ct solitaire">
          <Textarea rows={3} maxLength={500} {...register("description")} />
        </Field>
        <Field label="Colour" optional error={errors.colour?.message}>
          <Select {...register("colour")}>
            <option value="">Not specified</option>
            {GOLD_COLOURS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Design details" optional error={errors.design_details?.message} hint="Motifs, finish, stones, clasp: what makes this piece recognisable">
          <Textarea rows={3} maxLength={1000} {...register("design_details")} />
        </Field>
        <p className="text-[13px] text-muted">Photos are added on the piece's page after you save it.</p>
      </Section>
```

e) Replace Section 3 (`<Section step={3} title="Certification" ...>` to its closing tag) with:

```tsx
      <Section step={3} title="Verification" description="How far the store vouches for this piece. The buyer's badge matches it exactly.">
        <Field label="Verification level" error={errors.verification_level?.message} hint={LEVEL_HINT[level ?? "declared"]}>
          <Select {...register("verification_level")}>
            {VERIFICATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {VERIFICATION_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
        {level === "hallmark" && (
          <Field label="HUID" error={errors.huid?.message} hint="The 6-character code laser-marked on the piece">
            <Input autoComplete="off" maxLength={6} className="uppercase tracking-[0.2em]" placeholder="AB12CD" {...register("huid")} />
          </Field>
        )}
        {level === "lab" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Certificate ID" error={errors.certificate_id?.message}>
                <Input autoComplete="off" placeholder="e.g. HM-26-014823" {...register("certificate_id")} />
              </Field>
              <Field label="Certificate date" error={errors.certificate_date?.message}>
                <Input type="date" max={new Date().toISOString().slice(0, 10)} {...register("certificate_date")} />
              </Field>
            </div>
            <Field label="Issuing authority" error={errors.issuing_authority?.message}>
              <Input placeholder="e.g. assaying and hallmarking centre" {...register("issuing_authority")} />
            </Field>
            <CertificateUpload file={certificate} onChange={setCertificate} existing={existingDocument} />
          </>
        )}
      </Section>
```

f) Insert a new Section 5 just before the sticky submit bar (`<div className="sticky bottom-0 ...`):

```tsx
      <Section step={5} title="Listing and discount" description="Whether buyers can see the piece, and any offer on it.">
        <Field label="Stock" error={errors.stock_status?.message}>
          <Select {...register("stock_status")}>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STOCK_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-1.5">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-basalt" disabled={!canPublish} {...register("is_published")} />
            <span>
              <span className="block text-[13px] font-medium text-ink">Published</span>
              <span className="block text-[13px] text-muted">
                {canPublish
                  ? "Buyers can see this piece and its QR code opens its page."
                  : "Add a photo on the piece's page first. Until it's published, its QR code says the record wasn't found."}
              </span>
            </span>
          </label>
          {errors.is_published && (
            <p role="alert" className="text-[13px] text-danger">
              {errors.is_published.message}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Discount" error={errors.discount_type?.message}>
            <Select {...register("discount_type")}>
              <option value="">No discount</option>
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
            </Select>
          </Field>
          <Field label={discountType === "flat" ? "Amount off" : "Percent off"} error={errors.discount_value?.message}>
            <Input
              inputMode="decimal"
              autoComplete="off"
              disabled={!discountType}
              prefix={discountType === "flat" ? "₹" : undefined}
              suffix={discountType === "percent" ? <span className="pr-2 text-sm text-muted">%</span> : undefined}
              {...register("discount_value")}
            />
          </Field>
          <Field label="Ends on" optional error={errors.discount_ends_on?.message} hint="Last day of the offer">
            <Input type="date" disabled={!discountType} {...register("discount_ends_on")} />
          </Field>
        </div>
        <DiscountPreview input={toPreviewInput(values)} />
      </Section>
```

g) Delete the now-unused `photo`/`setPhoto` state and `existingPhoto` prop references.

- [ ] **Step 5: Add, edit and detail pages**

In `frontend/src/pages/admin/AddJewelleryPage.tsx`:

a) Replace `RegistrationSuccess`'s heading, paragraph, data rows and buttons so the component reads:

```tsx
function RegistrationSuccess({ item, onAnother }: { item: Jewellery; onAnother: () => void }) {
  const qr = useQrImage(item.jewellery_id);
  return (
    <Panel className="mx-auto max-w-4xl overflow-hidden">
      <div className="flex items-start gap-4 border-b border-line bg-basalt-50/60 px-6 py-6 sm:px-8">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-basalt" strokeWidth={1.75} />
        <div>
          <h1 className="font-display text-[26px] leading-tight text-basalt">Piece registered</h1>
          <p className="mt-1 text-[15px] text-muted">
            Add its photos and publish it from the record page. Its QR code starts working once it's published.
          </p>
        </div>
      </div>

      <div className="grid gap-10 px-6 py-8 sm:px-8 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Jewellery ID</p>
          <p className="tabular mt-1 font-display text-[30px] tracking-[0.06em] text-ink">{item.jewellery_id}</p>
          <dl className="mt-6 divide-y divide-line border-y border-line text-[15px]">
            {[
              ["Title", item.title],
              ["Store", item.store.name],
              ["Purity", formatPurity(item.purity, item.purity_percent)],
              ["Net gold weight", formatWeight(item.net_weight)],
              ["Price now", formatINRRange(item.price.final_min, item.price.final_max)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link to={`/admin/jewellery/${item.jewellery_id}`} className={buttonVariants()}>
              Add photos and publish
            </Link>
            <Link to="/admin/jewellery" className={buttonVariants({ variant: "secondary" })}>
              Back to pieces
            </Link>
            <Button variant="ghost" onClick={onAnother}>
              <Plus /> Register another
            </Button>
          </div>
        </div>
        <QrPanel item={item} qr={qr} />
      </div>
    </Panel>
  );
}
```

and change the format import to `import { formatINRRange, formatPurity, formatWeight } from "@/utils/format";`.

b) Replace the `<PageHeader ... />` and `<JewelleryForm ... />` in `AddJewelleryPage` with:

```tsx
      <PageHeader title="Add piece" description="Saving creates the piece's Jewellery ID, digital record and QR code." />
      <JewelleryForm
        key={formKey}
        submitLabel="Register piece"
        cancelTo="/admin/jewellery"
        canPublish={false}
        onSubmit={async (input, certificate) => {
          const { item, warning } = await savePiece(null, input, certificate, false);
          if (warning) toast.error(warning);
          toast.success("Piece registered.");
          setCreated(item);
          window.scrollTo({ top: 0 });
        }}
      />
```

add `import { savePiece } from "@/components/jewellery/savePiece";`, remove the now-unused `errorMessage` and `jewelleryService` imports, and change the `document.title` fallback to `"Add piece"`.

In `frontend/src/pages/admin/EditJewelleryPage.tsx`: remove the `usePhoto` import and `photoUrl` line, remove the `existingPhoto` prop, add `canPublish={item.photos.length > 0}`, add `import { savePiece } from "@/components/jewellery/savePiece";`, and replace the `onSubmit` handler with:

```tsx
        onSubmit={async (input, certificate) => {
          const { warning } = await savePiece(item.jewellery_id, input, certificate, item.has_certificate_document);
          if (warning) toast.error(warning);
          toast.success("Changes saved successfully.");
          navigate(`/admin/jewellery/${item.jewellery_id}`);
        }}
```

Replace `frontend/src/pages/admin/JewelleryDetailPage.tsx` with:

```tsx
import { ArrowLeft, Download, FileText, PencilLine, Power, PowerOff, SearchX } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { QrPanel } from "@/components/jewellery/QrPanel";
import { LevelBadge, ListingBadge, StatusBadge } from "@/components/jewellery/StatusBadge";
import { PageHeader } from "@/components/layout/AdminLayout";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DataRow, Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useJewelleryRecord } from "@/hooks/useJewellery";
import { useQrImage } from "@/hooks/useQrImage";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import { certificateFilename, saveBlob } from "@/utils/download";
import { formatDate, formatPercent, formatPurity, formatWeight } from "@/utils/format";

const backLink = (
  <Link to="/admin/jewellery" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All pieces
  </Link>
);

export function RecordMissing({ id, message, onRetry }: { id: string; message?: string; onRetry?: () => void }) {
  return (
    <>
      {backLink}
      <Panel>
        <EmptyState
          icon={SearchX}
          title={message ? "The record could not be loaded" : `No record with ID ${id}`}
          description={message ?? "Check the Jewellery ID, or find the piece in the list."}
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            ) : (
              <Link to="/admin/jewellery" className={buttonVariants({ variant: "secondary" })}>
                Go to pieces
              </Link>
            )
          }
        />
      </Panel>
    </>
  );
}

function InfoCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} action={aside} />
      <div className="px-5 py-3 sm:px-6">{children}</div>
    </Panel>
  );
}

export function JewelleryDetailPage() {
  const { id = "" } = useParams();
  const { item, setItem, error, notFound, loading, reload } = useJewelleryRecord(id);
  const qr = useQrImage(item?.jewellery_id);

  useEffect(() => {
    document.title = id;
  }, [id]);

  if (notFound) return <RecordMissing id={id} />;
  if (error) return <RecordMissing id={id} message={error} onRetry={reload} />;

  if (loading || !item) {
    return (
      <>
        <PageHeader back={backLink} title={<Skeleton className="h-9 w-56" />} />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Panel key={i} className="space-y-3 p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </Panel>
            ))}
          </div>
          <Panel className="p-6">
            <Skeleton className="aspect-square w-full" />
          </Panel>
        </div>
      </>
    );
  }

  async function deactivate() {
    try {
      setItem(await jewelleryService.deactivate(item!.jewellery_id));
      toast.success("Jewellery record deactivated.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function activate() {
    try {
      setItem(await jewelleryService.activate(item!.jewellery_id));
      toast.success("Jewellery record reactivated.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function downloadCertificate() {
    try {
      const blob = await jewelleryService.downloadCertificate(item!.jewellery_id);
      saveBlob(blob, certificateFilename(item!.jewellery_id, blob));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const active = item.status === "active";
  const ranged = item.making_percent_min !== null && item.making_percent_max !== null;

  return (
    <>
      <PageHeader
        back={backLink}
        title={<span className="tabular tracking-[0.04em]">{item.jewellery_id}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <LevelBadge level={item.verification_level} />
            <ListingBadge published={item.is_published} stock={item.stock_status} />
            <span className="text-[13px]">Registered {formatDate(item.created_at)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={qr.download} disabled={!qr.url}>
              <Download /> Download QR
            </Button>
            <Link to={`/admin/jewellery/${item.jewellery_id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <PencilLine /> Edit
            </Link>
            {active ? (
              <ConfirmDialog
                title={`Deactivate ${item.jewellery_id}?`}
                description="Its QR code will stop verifying and buyers will see that the record is inactive. You can reactivate it later."
                confirmLabel="Deactivate"
                onConfirm={deactivate}
                trigger={
                  <Button variant="danger-outline">
                    <PowerOff /> Deactivate
                  </Button>
                }
              />
            ) : (
              <ConfirmDialog
                title={`Reactivate ${item.jewellery_id}?`}
                description="Its QR code will open the verification page again."
                confirmLabel="Reactivate"
                tone="primary"
                onConfirm={activate}
                trigger={
                  <Button variant="secondary">
                    <Power /> Reactivate
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel className="md:col-span-2">
            <PanelHeader title="Photos" description="The first photo is the cover. A published piece keeps at least one." />
            <div className="p-5 sm:p-6">
              <PhotoManager owner="jewellery" ownerKey={item.jewellery_id} photos={item.photos} onChange={(photos) => setItem({ ...item, photos })} />
            </div>
          </Panel>

          <InfoCard title="Piece">
            <dl className="divide-y divide-line">
              <DataRow
                label="Store"
                value={
                  <Link to={`/admin/stores/${item.store.slug}/edit`} className="text-basalt hover:underline">
                    {item.store.name}
                  </Link>
                }
              />
              <DataRow label="Title" value={item.title} />
              <DataRow label="Category" value={item.type} />
              <DataRow label="Colour" value={item.colour ?? <span className="text-muted">Not specified</span>} />
              <div className="py-2.5">
                <dt className="text-[13px] text-muted">Description</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink">{item.description}</dd>
              </div>
              {item.design_details && (
                <div className="py-2.5">
                  <dt className="text-[13px] text-muted">Design details</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-ink">{item.design_details}</dd>
                </div>
              )}
            </dl>
          </InfoCard>

          <InfoCard title="Gold information" aside={<HallmarkStamp purity={item.purity} percent={item.purity_percent} />}>
            <dl className="divide-y divide-line">
              <DataRow label="Purity" value={formatPurity(item.purity, item.purity_percent)} mono />
              <DataRow label="Gross weight" value={formatWeight(item.gross_weight)} mono />
              <DataRow label="Net weight" value={formatWeight(item.net_weight)} mono />
            </dl>
          </InfoCard>

          <InfoCard title="Verification">
            <dl className="divide-y divide-line">
              <DataRow label="Level" value={<LevelBadge level={item.verification_level} />} />
              {item.huid && <DataRow label="HUID" value={item.huid} mono />}
              {item.certificate_id && (
                <>
                  <DataRow label="Certificate ID" value={item.certificate_id} mono />
                  <DataRow label="Issuing authority" value={item.issuing_authority ?? "—"} />
                  <DataRow label="Certificate date" value={formatDate(item.certificate_date)} />
                  <DataRow
                    label="Document"
                    value={
                      item.has_certificate_document ? (
                        <button type="button" onClick={downloadCertificate} className="inline-flex items-center gap-1.5 text-basalt hover:underline">
                          <FileText className="size-4" /> Download
                        </button>
                      ) : (
                        <span className="text-muted">Not uploaded</span>
                      )
                    }
                  />
                </>
              )}
            </dl>
          </InfoCard>

          <InfoCard title="Price buyers see now">
            <PriceBreakdown price={item.price} className="py-3" />
            <p className="border-t border-line py-3 text-[13px] text-muted">
              {ranged
                ? `Making charges are ${formatPercent(item.making_percent_min!)}–${formatPercent(item.making_percent_max!)} of the live gold value.`
                : "No making charges range: buyers see the fixed amount."}
            </p>
          </InfoCard>
        </div>

        <Panel className="lg:sticky lg:top-8">
          <PanelHeader title="QR code" description={item.is_published ? "Opens the public verification page." : "Works once the piece is published."} />
          <QrPanel item={item} qr={qr} className="p-5" />
        </Panel>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Table, list, dashboard and settings**

In `frontend/src/components/jewellery/JewelleryTable.tsx`:

a) Change the imports: `import { formatDate, formatINRRange, formatWeight } from "@/utils/format";` and `import { LevelBadge, ListingBadge, StatusBadge } from "./StatusBadge";`.

b) Replace the `ColumnKey` type and `COLUMNS` with:

```tsx
type ColumnKey = "id" | "title" | "store" | "type" | "purity" | "weight" | "level" | "listing" | "price" | "status" | "created";

const COLUMNS: Record<ColumnKey, Column> = {
  id: {
    key: "id",
    label: "Jewellery ID",
    sort: "jewellery_id",
    render: (j) => (
      <Link to={`/admin/jewellery/${j.jewellery_id}`} className="tabular font-medium tracking-wide text-basalt hover:underline">
        {j.jewellery_id}
      </Link>
    ),
  },
  title: { key: "title", label: "Title", render: (j) => j.title },
  store: { key: "store", label: "Store", render: (j) => j.store.name },
  type: { key: "type", label: "Category", sort: "type", render: (j) => j.type },
  purity: { key: "purity", label: "Purity", render: (j) => j.purity },
  weight: { key: "weight", label: "Net weight", sort: "net_weight", align: "right", render: (j) => formatWeight(j.net_weight) },
  level: { key: "level", label: "Verification", render: (j) => <LevelBadge level={j.verification_level} /> },
  listing: { key: "listing", label: "Listing", render: (j) => <ListingBadge published={j.is_published} stock={j.stock_status} /> },
  price: {
    key: "price",
    label: "Price now",
    sort: "total_price",
    align: "right",
    render: (j) => formatINRRange(j.price.final_min, j.price.final_max),
  },
  status: { key: "status", label: "Status", render: (j) => <StatusBadge status={j.status} /> },
  created: { key: "created", label: "Created", sort: "created_at", render: (j) => formatDate(j.created_at) },
};
```

In `frontend/src/pages/admin/JewelleryListPage.tsx`:

a) Add imports `import { useStores } from "@/hooks/useStores";` and extend the types import with `STOCK_LABEL, STOCK_STATUSES`.

b) In the `query` memo add:

```tsx
      store: params.get("store") ?? "",
      published: (params.get("published") ?? "") as JewelleryQuery["published"],
      stock: (params.get("stock") ?? "") as JewelleryQuery["stock"],
```

c) Add `const { stores } = useStores();` below the `useJewelleryList` line, and change `filtered` to `Boolean(query.search || query.type || query.purity || query.status || query.store || query.published || query.stock)`.

d) Replace the filter grid (`<div className="grid gap-3 border-b ...">` to its closing tag) with:

```tsx
        <div className="space-y-3 border-b border-line p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Jewellery ID, title, certificate ID or category"
              aria-label="Search pieces"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Select aria-label="Filter by store" value={query.store} onChange={(e) => update({ store: e.target.value })}>
              <option value="">All stores</option>
              {stores?.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by category" value={query.type} onChange={(e) => update({ type: e.target.value })}>
              <option value="">All categories</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select aria-label="Filter by purity" value={query.purity} onChange={(e) => update({ purity: e.target.value })}>
              <option value="">All purities</option>
              {PURITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Select aria-label="Filter by listing" value={query.published} onChange={(e) => update({ published: e.target.value })}>
              <option value="">Published or draft</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </Select>
            <Select aria-label="Filter by stock" value={query.stock} onChange={(e) => update({ stock: e.target.value })}>
              <option value="">Any stock</option>
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STOCK_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={query.status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
```

e) Change the table's `columns` to `["id", "title", "store", "purity", "weight", "level", "listing", "price", "status"]`, the page title to `"Pieces"` (`document.title` too), the header button label to `Add piece`, and the empty state texts to "No pieces registered yet" / "Register your first piece to create its digital record and QR code." with the button label `Add piece`.

In `frontend/src/pages/admin/DashboardPage.tsx`, replace `STAT_CARDS` with:

```tsx
const STAT_CARDS: { key: keyof JewelleryStats; label: string; note: string }[] = [
  { key: "stores", label: "Stores", note: "Shops on the marketplace" },
  { key: "published", label: "Published pieces", note: "Active and visible to buyers" },
  { key: "in_stock", label: "In stock", note: "Published pieces buyers can buy" },
  { key: "designs", label: "Designs", note: "Made-to-order designs" },
];
```

change the add button label to `Add piece`, the panel title to "Recent pieces", the empty-state title to "No pieces registered yet", and the table `columns` to `["id", "title", "store", "listing", "price", "created"]`.

In `frontend/src/pages/admin/SettingsPage.tsx`:

a) Replace the schema with:

```tsx
const schema = z.object({
  gst_percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Use a percentage with up to 2 decimals, e.g. 3")
    .refine((v) => Number(v) <= 100, "Must be 100% or less"),
});
```

b) Change `defaultValues` to `{ gst_percent: "3" }` and the `reset` call to `reset({ gst_percent: String(Number(s.gst_percent)) });`.

c) Change the `PageHeader` description to `"Applies to every store's prices."`, the first panel's title to `"Tax"`, and delete the "Store name" `<Field>`; store names are edited on each store's page.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/jewellery frontend/src/pages/admin
git commit -m "Update the pieces admin for stores, verification levels, publishing and discounts"
```

---

### Task 12: Designs admin

**Files:**
- Create: `frontend/src/components/designs/designSchema.ts`, `frontend/src/pages/admin/DesignListPage.tsx`, `frontend/src/pages/admin/DesignFormPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `designService`, `useStores`, `PhotoManager`, `Design`, `DesignInput`.
- Produces: routes `/admin/designs`, `/admin/designs/new`, `/admin/designs/:id/edit`.

- [ ] **Step 1: Form schema**

Create `frontend/src/components/designs/designSchema.ts`:

```ts
import { z } from "zod";
import { JEWELLERY_TYPES, PURITIES, type Design, type DesignInput } from "@/types";

const weight = z
  .string()
  .trim()
  .min(1, "Enter a weight")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number with up to 3 decimals")
  .refine((v) => Number(v) > 0, "Must be more than 0");

const price = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number without commas")
  .refine((v) => Number(v) > 0, "Must be more than 0");

const days = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, "Whole days, e.g. 14")
  .refine((v) => Number(v) >= 1 && Number(v) <= 365, "Between 1 and 365 days");

export const designSchema = z
  .object({
    store: z.string().min(1, "Choose the store"),
    title: z.string().trim().min(2, "Give the design a short title").max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(1000, "Keep it under 1000 characters"),
    category: z.enum(JEWELLERY_TYPES, { message: "Choose a category" }),
    purity_options: z.array(z.enum(PURITIES)).min(1, "Choose at least one purity"),
    weight_min: weight,
    weight_max: weight,
    price_min: price,
    price_max: price,
    making_days_min: days,
    making_days_max: days,
    is_published: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const pairs = [
      ["weight_min", "weight_max"],
      ["price_min", "price_max"],
      ["making_days_min", "making_days_max"],
    ] as const;
    for (const [low, high] of pairs) {
      if (Number(v[high]) < Number(v[low])) ctx.addIssue({ code: "custom", path: [high], message: "Can't be below the minimum" });
    }
  });

export type DesignFormValues = z.infer<typeof designSchema>;

export const emptyDesign: DesignFormValues = {
  store: "",
  title: "",
  description: "",
  category: "" as DesignFormValues["category"],
  purity_options: ["22K"],
  weight_min: "",
  weight_max: "",
  price_min: "",
  price_max: "",
  making_days_min: "",
  making_days_max: "",
  is_published: false,
};

const plain = (v: string) => String(Number(v));

export function designToForm(d: Design): DesignFormValues {
  return {
    store: d.store.slug,
    title: d.title,
    description: d.description ?? "",
    category: d.category,
    purity_options: d.purity_options,
    weight_min: plain(d.weight_min),
    weight_max: plain(d.weight_max),
    price_min: plain(d.price_min),
    price_max: plain(d.price_max),
    making_days_min: String(d.making_days_min),
    making_days_max: String(d.making_days_max),
    is_published: d.is_published,
  };
}

export function designToInput(v: DesignFormValues): DesignInput {
  return {
    ...v,
    description: v.description || null,
    making_days_min: Number(v.making_days_min),
    making_days_max: Number(v.making_days_max),
  };
}
```

- [ ] **Step 2: List page**

Create `frontend/src/pages/admin/DesignListPage.tsx`:

```tsx
import { Palette, PencilLine, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { errorMessage } from "@/services/api";
import { designService } from "@/services/designs";
import type { Design } from "@/types";
import { formatINRRange } from "@/utils/format";

const iconLink = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-basalt-50 hover:text-basalt";

export function DesignListPage() {
  const { stores } = useStores();
  const [store, setStore] = useState("");
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    designService
      .list({ store })
      .then(setDesigns)
      .catch((err) => setError(errorMessage(err)));
  }, [store]);

  useEffect(() => {
    document.title = "Designs";
    load();
  }, [load]);

  async function remove(design: Design) {
    try {
      await designService.remove(design.public_id);
      setDesigns((all) => all && all.filter((d) => d.public_id !== design.public_id));
      toast.success(`${design.title} deleted.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const addButton = (
    <Link to="/admin/designs/new" className={buttonVariants({ size: "lg" })}>
      <Plus /> Add design
    </Link>
  );

  return (
    <>
      <PageHeader title="Designs" description="Pieces a store can make to order. Buyers see them as approximate, never as verified." actions={addButton} />
      <Panel>
        <div className="border-b border-line p-4 sm:p-5">
          <Select aria-label="Filter by store" value={store} onChange={(e) => setStore(e.target.value)} className="sm:w-64">
            <option value="">All stores</option>
            {stores?.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
              Try again
            </Button>
          </div>
        ) : designs === null ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <EmptyState icon={Palette} title="No designs yet" description="Add the designs a store can make, with an approximate price and making time." action={addButton} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Design</th>
                  <th className="px-5 py-3 font-medium">Store</th>
                  <th className="px-5 py-3 text-right font-medium">Approx. price</th>
                  <th className="px-5 py-3 font-medium">Making time</th>
                  <th className="px-5 py-3 font-medium">Listing</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {designs.map((d) => (
                  <tr key={d.public_id}>
                    <td className="px-5 py-3">
                      <Link to={`/admin/designs/${d.public_id}/edit`} className="font-medium text-basalt hover:underline">
                        {d.title}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {d.category} · {d.purity_options.join(", ")}
                      </p>
                    </td>
                    <td className="px-5 py-3">{d.store.name}</td>
                    <td className="tabular px-5 py-3 text-right">{formatINRRange(d.price_min, d.price_max)}</td>
                    <td className="px-5 py-3">
                      {d.making_days_min === d.making_days_max ? d.making_days_min : `${d.making_days_min}–${d.making_days_max}`} days
                    </td>
                    <td className="px-5 py-3 text-[13px]">{d.is_published ? "Published" : <span className="text-muted">Draft</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/admin/designs/${d.public_id}/edit`} className={iconLink} aria-label={`Edit ${d.title}`} title="Edit">
                          <PencilLine className="size-4" />
                        </Link>
                        <ConfirmDialog
                          title={`Delete ${d.title}?`}
                          description="The design and its photos are removed permanently."
                          confirmLabel="Delete design"
                          onConfirm={() => remove(d)}
                          trigger={
                            <button type="button" className={iconLink} aria-label={`Delete ${d.title}`}>
                              <Trash2 className="size-4" />
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
```

- [ ] **Step 3: Form page**

Create `frontend/src/pages/admin/DesignFormPage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { designSchema, designToForm, designToInput, emptyDesign, type DesignFormValues } from "@/components/designs/designSchema";
import { PageHeader } from "@/components/layout/AdminLayout";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { ApiError, errorMessage } from "@/services/api";
import { designService } from "@/services/designs";
import { JEWELLERY_TYPES, PURITIES, PURITY_PERCENT, type Design } from "@/types";

const back = (
  <Link to="/admin/designs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All designs
  </Link>
);

/** Add a design (/admin/designs/new) or edit one (/admin/designs/:id/edit). Photos can be added once it's saved. */
export function DesignFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stores } = useStores();
  const [design, setDesign] = useState<Design | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DesignFormValues>({ resolver: zodResolver(designSchema), defaultValues: emptyDesign, mode: "onTouched" });

  useEffect(() => {
    document.title = id ? "Edit design" : "Add design";
    if (!id) return;
    designService
      .get(id)
      .then((d) => {
        setDesign(d);
        reset(designToForm(d));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [id, reset]);

  useEffect(() => {
    if (stores?.length === 1 && !getValues("store")) setValue("store", stores[0].slug);
  }, [stores, getValues, setValue]);

  async function onSubmit(values: DesignFormValues) {
    try {
      const saved = id ? await designService.update(id, designToInput(values)) : await designService.create(designToInput(values));
      toast.success(id ? "Design saved." : "Design added. Add its photos, then publish it.");
      if (!id) navigate(`/admin/designs/${saved.public_id}/edit`, { replace: true });
      else {
        setDesign(saved);
        reset(designToForm(saved));
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in emptyDesign) setError(field as keyof DesignFormValues, { message });
        }
      }
      toast.error(errorMessage(err, "The design could not be saved. Try again."));
    }
  }

  if (loadError) {
    return (
      <>
        {back}
        <Panel className="p-8 text-center text-sm text-danger">{loadError}</Panel>
      </>
    );
  }

  const canPublish = (design?.photos.length ?? 0) > 0;
  const number = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <>
      <PageHeader
        back={back}
        title={id ? (design ? design.title : <Skeleton className="h-9 w-64" />) : "Add design"}
        description="Shown to buyers as approximate, with no verified badge or Jewellery ID."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Design details" />
          <form onSubmit={handleSubmit(onSubmit, () => toast.error("Check the highlighted fields."))} noValidate className="space-y-5 p-5 sm:p-6">
            <Field label="Store" error={errors.store?.message}>
              <Select {...register("store")} disabled={!stores}>
                <option value="" disabled>
                  {stores ? "Choose a store" : "Loading stores…"}
                </option>
                {stores?.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} ({s.area})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" error={errors.title?.message} hint="e.g. Temple necklace">
              <Input maxLength={120} {...register("title")} />
            </Field>
            <Field label="Category" error={errors.category?.message}>
              <Select {...register("category")}>
                <option value="" disabled>
                  Choose a category
                </option>
                {JEWELLERY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" optional error={errors.description?.message}>
              <Textarea rows={3} maxLength={1000} {...register("description")} />
            </Field>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] font-medium text-ink">Purity options</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PURITIES.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-[15px]">
                    <input type="checkbox" value={p} className="size-4 accent-basalt" {...register("purity_options")} />
                    {p} <span className="text-[13px] text-muted">({PURITY_PERCENT[p]}%)</span>
                  </label>
                ))}
              </div>
              {errors.purity_options && (
                <p role="alert" className="text-[13px] text-danger">
                  {errors.purity_options.message}
                </p>
              )}
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Weight from" error={errors.weight_min?.message}>
                <Input {...number} suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("weight_min")} />
              </Field>
              <Field label="Weight to" error={errors.weight_max?.message}>
                <Input {...number} suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("weight_max")} />
              </Field>
              <Field label="Approx. price from" error={errors.price_min?.message}>
                <Input {...number} prefix="₹" {...register("price_min")} />
              </Field>
              <Field label="Approx. price to" error={errors.price_max?.message}>
                <Input {...number} prefix="₹" {...register("price_max")} />
              </Field>
              <Field label="Making time from" error={errors.making_days_min?.message}>
                <Input inputMode="numeric" suffix={<span className="pr-2 text-sm text-muted">days</span>} {...register("making_days_min")} />
              </Field>
              <Field label="Making time to" error={errors.making_days_max?.message}>
                <Input inputMode="numeric" suffix={<span className="pr-2 text-sm text-muted">days</span>} {...register("making_days_max")} />
              </Field>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-basalt" disabled={!canPublish} {...register("is_published")} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Published</span>
                  <span className="block text-[13px] text-muted">
                    {canPublish ? "Buyers can see this design." : "Add a photo first (save the design, then use Photos)."}
                  </span>
                </span>
              </label>
              {errors.is_published && (
                <p role="alert" className="text-[13px] text-danger">
                  {errors.is_published.message}
                </p>
              )}
            </div>
            <Button type="submit" loading={isSubmitting}>
              {id ? "Save design" : "Add design"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Photos" description="The first photo is the cover." />
          <div className="p-5 sm:p-6">
            {design ? (
              <PhotoManager owner="designs" ownerKey={design.public_id} photos={design.photos} onChange={(photos) => setDesign({ ...design, photos })} />
            ) : (
              <p className="text-[13px] text-muted">{id ? "Loading…" : "Save the design first, then add its photos here."}</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Routes**

In `frontend/src/App.tsx`, add the lazy imports:

```tsx
const DesignListPage = named(() => import("@/pages/admin/DesignListPage"), "DesignListPage");
const DesignFormPage = named(() => import("@/pages/admin/DesignFormPage"), "DesignFormPage");
```

and the routes after the store routes:

```tsx
                <Route path="designs" element={<DesignListPage />} />
                <Route path="designs/new" element={<DesignFormPage />} />
                <Route path="designs/:id/edit" element={<DesignFormPage />} />
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/designs frontend/src/pages/admin/DesignListPage.tsx frontend/src/pages/admin/DesignFormPage.tsx frontend/src/App.tsx
git commit -m "Add made-to-order designs to the admin"
```

---

### Task 13: Buyer QR page and price breakdown

**Files:**
- Modify: `frontend/src/components/jewellery/PriceBreakdown.tsx`, `frontend/src/pages/VerifyPage.tsx`, `frontend/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `PiecePrice`, `PublicVerification`, `VERIFICATION_LABEL`, `STOCK_LABEL`, `photoService.url`, `formatDateTime`.
- Produces: `PriceBreakdown({ price, className?, emphasis?, stagger? })`.

- [ ] **Step 1: Rewrite the price breakdown**

Replace `frontend/src/components/jewellery/PriceBreakdown.tsx` with:

```tsx
import type { CSSProperties } from "react";
import type { PiecePrice } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatINR, formatINRRange, formatPercent } from "@/utils/format";

interface PriceBreakdownProps {
  price: PiecePrice;
  className?: string;
  /** Larger final price for the buyer-facing page. */
  emphasis?: boolean;
  /** Delay (ms) at which the lines start rising in, one after another. Omit for no entrance. */
  stagger?: number;
}

type Line = { label: string; amount: string; note?: string };

/** Itemised like a jeweller's estimate: label, dotted leader, amount. The lines add up to the final price. */
export function PriceBreakdown({ price, className, emphasis, stagger }: PriceBreakdownProps) {
  const ranged = price.making_percent_min !== null && price.making_percent_max !== null;
  const lines: Line[] = [
    { label: "Gold value", amount: formatINR(price.gold), note: price.rate_per_gram ? `At ${formatINR(price.rate_per_gram)}/g today` : undefined },
    {
      label: "Making charges",
      amount: formatINRRange(price.making_min, price.making_max),
      note: ranged ? `${formatPercent(price.making_percent_min!)}–${formatPercent(price.making_percent_max!)} of gold value` : undefined,
    },
    { label: "Stone / other components", amount: formatINR(price.other) },
    { label: "Tax", amount: formatINRRange(price.tax_min, price.tax_max), note: `GST ${formatPercent(price.gst_percent)}` },
  ];
  const { discount } = price;
  const rangedFinal = Number(price.final_min) !== Number(price.final_max);

  const animate = stagger !== undefined && "rise";
  const at = (i: number) => (stagger === undefined ? undefined : ({ "--d": `${stagger + i * 90}ms` } as CSSProperties));

  return (
    <div className={className}>
      <dl className="space-y-3">
        {lines.map(({ label, amount, note }, i) => (
          <div key={label} className={cn("text-[15px]", animate)} style={at(i)}>
            <div className="flex items-baseline">
              <dt className="text-ink/80">{label}</dt>
              <span className="leader" aria-hidden />
              <dd className="tabular whitespace-nowrap text-ink">{amount}</dd>
            </div>
            {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
          </div>
        ))}
      </dl>

      <div className={cn("mt-5 space-y-2 border-t border-ink/80 pt-4", animate)} style={at(lines.length + 1)}>
        {discount && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[15px]">
              <span className="text-ink/80">Original price</span>
              <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[15px]">
              <span className="inline-flex items-center gap-2 text-ink/80">
                Discount
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">{discount.label}</span>
              </span>
              <span className="tabular text-verified">− {formatINRRange(discount.amount_min, discount.amount_max)}</span>
            </div>
          </>
        )}
        <div className={cn("flex justify-between gap-x-4 gap-y-1", rangedFinal ? "flex-wrap items-end" : "items-baseline")}>
          <span className="text-[15px] font-semibold text-ink">{discount ? "Final price" : "Price"}</span>
          <span
            className={cn(
              "tabular ml-auto text-right font-semibold text-basalt",
              emphasis ? (rangedFinal ? "text-[24px] leading-tight tracking-tight sm:text-[26px]" : "text-[30px] leading-none tracking-tight sm:text-[34px]") : "text-xl",
            )}
          >
            {formatINRRange(price.final_min, price.final_max)}
          </span>
        </div>
        <p className="text-right text-xs leading-relaxed text-muted">
          Price as of {formatDateTime(price.as_of)}
          {discount?.ends_on ? `. Offer ends ${formatDate(discount.ends_on)}` : ""}. Final price confirmed at the store.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Landing page example**

In `frontend/src/pages/LandingPage.tsx`, add `import type { PiecePrice } from "@/types";`, add above the component:

```tsx
/** The landing page's worked example: the same breakdown a buyer sees, with a 5% offer. */
const EXAMPLE_PRICE: PiecePrice = {
  basis: "live",
  as_of: "2026-10-11T05:00:00Z",
  rate_per_gram: "13688",
  gold: "98500",
  making_min: "12000",
  making_max: "12000",
  making_percent_min: null,
  making_percent_max: null,
  other: "4000",
  gst_percent: "3",
  tax_min: "10500",
  tax_max: "10500",
  original_min: "125000",
  original_max: "125000",
  discount: { type: "percent", value: "5", label: "5% off", amount_min: "6250", amount_max: "6250", ends_on: null },
  final_min: "118750",
  final_max: "118750",
};
```

and replace `<PriceBreakdown gold_value={98500} making_charges={12000} other_component_value={4000} tax={10500} total_price={125000} emphasis />` with `<PriceBreakdown price={EXAMPLE_PRICE} emphasis />`.

- [ ] **Step 3: The QR page**

In `frontend/src/pages/VerifyPage.tsx`:

a) Replace the imports with:

```tsx
import { BadgeCheck, Info, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { Skeleton } from "@/components/ui/skeleton";
import { GoldRateTape, GoldRateTicker } from "@/components/verify/GoldRateTicker";
import { RecordUnavailable } from "@/components/verify/RecordUnavailable";
import { ApiError, errorMessage } from "@/services/api";
import { photoService } from "@/services/photos";
import { verifyService } from "@/services/verify";
import { STOCK_LABEL, VERIFICATION_LABEL, type PublicVerification, type VerificationLevel } from "@/types";
import { formatDate, formatPurity, formatWeight } from "@/utils/format";
```

b) Add above `ResultBanner`:

```tsx
function LevelIcon({ level, className }: { level: VerificationLevel; className?: string }) {
  const Icon = level === "declared" ? ShieldCheck : BadgeCheck;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}

/** One line on what the level means, so "Declared by store" can't be mistaken for verified. */
function levelSummary(record: PublicVerification): string {
  switch (record.verification_level) {
    case "lab":
      return "Backed by a lab certificate, shown below.";
    case "hallmark":
      return `Linked to BIS hallmark HUID ${record.huid}.`;
    case "declared":
      return "These details are as declared by the store. No hallmark or certificate is linked to this record.";
  }
}
```

c) Replace `ResultBanner` with:

```tsx
function ResultBanner({ record, checkedAt }: { record: PublicVerification; checkedAt: Date }) {
  return (
    <div className="grain rise relative px-5 pb-16 pt-8 text-chalk sm:rounded-t-lg sm:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 animate-[strike_650ms_250ms_cubic-bezier(.22,1,.36,1)_both] place-items-center rounded-full border border-gold-bright/70 bg-gold-bright/10 text-gold-bright">
          <LevelIcon level={record.verification_level} className="size-6" />
        </span>
        <h1 className="font-display text-[30px] leading-none sm:text-[36px]">{VERIFICATION_LABEL[record.verification_level]}</h1>
      </div>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-chalk/85">
        Listed on Jewlerify by {record.store.name}, {record.store.area}. {levelSummary(record)}
      </p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-white/15 pt-4">
        <div>
          <p className="text-xs text-chalk/60">Jewellery ID</p>
          <p className="tabular mt-0.5 text-lg font-medium tracking-[0.08em]">{record.jewellery_id}</p>
        </div>
        <p className="text-xs text-chalk/60">
          Checked {checkedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      {/* A tab of the white card reaching up into the banner: whose piece this is. */}
      <p className="absolute bottom-0 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-t-lg bg-white px-4 pb-1 pt-3 font-display text-[24px] leading-tight text-ink sm:left-6">
        <span className="sr-only">Store: </span>
        {record.store.name}
      </p>
    </div>
  );
}
```

d) Replace `ProductPhoto` and `PriceNote` with:

```tsx
function ProductPhoto({ record }: { record: PublicVerification }) {
  const cover = record.photos[0];
  if (!cover) return null;
  return (
    <a
      href={photoService.url(cover.public_id, "full")}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-md border border-gold/50 p-1"
      aria-label="Open the product photo"
    >
      <img
        src={photoService.url(cover.public_id, "thumb")}
        alt={cover.alt}
        width={cover.width}
        height={cover.height}
        className="aspect-[3/4] w-28 rounded-[3px] object-cover sm:w-36"
        loading="eager"
        decoding="async"
      />
    </a>
  );
}

function PriceNote({ record }: { record: PublicVerification }) {
  return record.price.basis === "live" ? (
    <>Gold value at today's market rate; making charges and tax as the range this store charges.</>
  ) : (
    <>The live gold rate isn't available right now, so this is the price as registered by the store.</>
  );
}
```

e) In `VerifiedRecord`:
- delete the `const verified = ...` line;
- in the details section replace `<h2 ...>{record.type}</h2>` and the description paragraph with:

```tsx
            <h2 className="mt-1.5 font-display text-[26px] leading-tight text-ink">{record.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              {record.type} · {record.description}
            </p>
            {record.stock_status !== "in_stock" && (
              <span className="mt-3 inline-flex rounded-full border border-line-strong bg-chalk px-2.5 py-0.5 text-xs font-semibold text-ink">
                {STOCK_LABEL[record.stock_status]}
              </span>
            )}
```

- replace the whole `<Section title="Certification" at={330}>…</Section>` with:

```tsx
        <Section title="Verification" at={330}>
          <dl>
            <Row
              label="Level"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <LevelIcon level={record.verification_level} className="size-4 text-gold-deep" />
                  {VERIFICATION_LABEL[record.verification_level]}
                </span>
              }
            />
            {record.huid && <Row label="Hallmark HUID" value={<span className="tracking-[0.15em]">{record.huid}</span>} />}
            {record.certificate_id && (
              <>
                <Row label="Certificate ID" value={<span className="tracking-wide">{record.certificate_id}</span>} />
                <Row label="Issuing authority" value={record.issuing_authority ?? "Not recorded"} />
                <Row label="Certificate date" value={formatDate(record.certificate_date)} />
              </>
            )}
          </dl>
          {record.verification_level === "declared" && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Ask the store to show you the hallmark when you visit.</p>
          )}
        </Section>
```

- replace both `<PriceBreakdown {...record} live={record.live_price} emphasis stagger={…} />` with `<PriceBreakdown price={record.price} emphasis stagger={500} />` (mobile) and `<PriceBreakdown price={record.price} emphasis stagger={450} />` (aside), and the aside's `How the {record.live_price ? "price" : "total price"} is made up.` with `How the price is made up.`;
- in the "Verification status" section, replace the first `<Row ... />` with:

```tsx
            <Row
              label="Verification level"
              strong
              value={
                <span className="inline-flex items-center gap-1.5 text-verified">
                  <LevelIcon level={record.verification_level} className="size-4" />
                  {VERIFICATION_LABEL[record.verification_level]}
                </span>
              }
            />
```

f) In `VerifyPage`, change the `document.title` expression for the found state to `` `${state.record.jewellery_id}, ${VERIFICATION_LABEL[state.record.verification_level].toLowerCase()}` ``.

- [ ] **Step 4: Type check and build the whole frontend**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: no type errors; the build completes ("✓ built in …"). Fix any error before continuing; they point at a step above that was missed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/jewellery/PriceBreakdown.tsx frontend/src/pages/VerifyPage.tsx frontend/src/pages/LandingPage.tsx
git commit -m "Show verification levels, discounts and the store on the buyer page"
```

---

### Task 14: End-to-end check on the local stack

No new code; this proves the parts work together. Fix anything it finds in the task that owns the code, and commit the fix there.

**Files:** none (screenshots go to the scratchpad).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && .venv/Scripts/python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 2: Migrate and seed the local Postgres**

Run: `docker compose up -d db` (from the repo root) then `cd backend && .venv/Scripts/python -m alembic upgrade head && .venv/Scripts/python seed.py`
Expected: `Running upgrade 0004_store_and_live_pricing -> 0005_marketplace_foundation`; the seed prints `Jewellery already seeded` if the local database already had the five pieces (they keep their store and photos from the migration), or creates them.

Then check the migration's result: `.venv/Scripts/python -c "from app.database import SessionLocal; from app.models import Store, Jewellery; db = SessionLocal(); print([(s.slug, s.city) for s in db.query(Store)]); print([(j.title, j.verification_level, j.is_published, len(j.photos)) for j in db.query(Jewellery)])"`
Expected: one store in Mumbai; five pieces, `declared`, published, one photo each.

- [ ] **Step 3: Run the app and click through**

Start the backend (`.venv/Scripts/python -m uvicorn app.main:app --port 8010`) and frontend (`npm run dev`) in the background. Signed in as the seed admin:

1. Stores: edit the placeholder store, add a phone number and a photo; the list shows 5 pieces.
2. Pieces: open the Nakshi kada; reorder photos is disabled with one photo; add a second photo and move it first; set a 10% discount ending today and save; the preview and detail price show the struck-through original, "10% off" and the final price.
3. Set the Casting ring to Hallmark linked with a HUID; try Lab verified without a file and see the field error.
4. Designs: add a design, try to publish without a photo (disabled with the hint), add a photo, publish.
5. Open `/verify/UWPVS7T9QZR9` signed out: banner says "Declared by store", the store tab shows the store name, the price shows the discount.

- [ ] **Step 4: Screenshots**

With the dev servers running, capture the buyer page at phone and desktop width and the main admin screens using the headless-Edge script in the scratchpad (`node shot.mjs <url> <out.png> <width>`): `/verify/UWPVS7T9QZR9` at 390 and 1280; `/admin/stores`, `/admin/jewellery/JWL-26-B2TPBR`, `/admin/jewellery/JWL-26-B2TPBR/edit`, `/admin/designs` at 1280 (admin pages need the signed-in token preloaded with `PRELOAD`). Check: nothing overflows at 390 px, every badge matches the stored level, prices add up.

- [ ] **Step 5: Stop the servers**

Stop the background uvicorn and Vite processes.

Production (migration 0005, seed and `vercel deploy --prod`) is **not** part of this plan's execution: it needs the user's go-ahead, as last time.
