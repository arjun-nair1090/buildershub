# Marketplace Buyer Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give buyers a photo gallery and similar pieces on the piece page, plus public store and design pages.

**Architecture:** Two new public read-only endpoints under `/api/public` (store page, design page) and a
`similar` list on the existing verify response, all built from two shared card shapes (`PieceCard`,
`DesignCard`) whose prices come from the existing `piece_price`. The frontend adds a scroll-snap gallery,
card tiles, a small loader hook and two new routes, and updates the piece page.

**Tech Stack:** FastAPI, SQLAlchemy 2, Pydantic v2, pytest on SQLite; React 19, TypeScript, Vite 8,
Tailwind v4, react-router, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-11-marketplace-buyer-pages-design.md`

## Global Constraints

- No database migration, no admin changes, no new dependencies (backend or frontend).
- Printed QR links keep working: the piece page stays at `/verify/{token}`.
- Lists link to pieces as `/verify/{jewellery_id}`; a QR token never appears in a list or card.
- A design never shows a verification badge, a Jewellery ID, a gold rate or a price breakdown; its prices
  always read "approx".
- Card prices come from `piece_price` with the same `pricing_context`, so a card and its piece page agree.
- Similar pieces: same store, published, active, not sold, not the current piece; score category +4,
  purity +2, final-price midpoint within ±30% +1; keep score >= 1; order score desc, price gap asc,
  Jewellery ID asc; at most 8.
- Store page pieces: published and active; in stock and reserved first, then sold; newest first in each group.
- Error copy: `404 "Store not found"`, `410 "Store no longer listed"`, `404 "Design not found"`,
  `410 "Design no longer listed"`.
- No diamond graphics (the brief removes them); use other lucide icons.
- No contact buttons on piece or design pages; they link to the store page.
- Commit messages: plain sentences in the repo's style ("Add ..."), no AI attribution or co-author trailers.
- Backend tests: `cd backend && python -m pytest -q`. Frontend has no test runner; its gate is
  `cd frontend && npm run build` (runs `tsc -b`) plus the visual checks in Tasks 5–7. Don't add a runner.

## Review Focus

1. A store with no phone or WhatsApp: Call and WhatsApp hidden, Directions and the map still shown (Task 6
   visual check uses the local placeholder store, which has no WhatsApp).
2. A sold piece that has a discount: its card must show no discount, matching its page (Task 1 test
   `test_card_prices_match_the_piece_page`).
3. A slug or design ID typed in another case resolves (`TEST-STORE`, lower-case `dsn...`) (Task 1 and Task 2 tests).
4. A gallery with one photo shows no arrows or dots; with several, the dot follows a swipe and the arrow
   keys move one photo (Task 4 component, checked in Task 5).
5. Long titles and store names on cards at 390 px truncate instead of widening the page (Task 6 visual check,
   no horizontal page scroll).

---

### Task 1: Card shapes and the public store endpoint

**Files:**
- Modify: `backend/app/schemas.py` (add card and store-page schemas before `class PublicVerification`)
- Create: `backend/app/services/cards.py`
- Create: `backend/app/routers/public.py`
- Modify: `backend/app/main.py` (include the router)
- Create: `backend/tests/test_public.py`

**Interfaces:**
- Consumes: `piece_price(piece, rate, gst_percent, today) -> PiecePrice`, `pricing_context(db) -> PricingContext`
  (fields `rate`, `gst_percent`, `today`) from `app/services/pricing.py`; `photo_out(photo, title) -> PhotoOut`
  from `app/services/photos.py`; `Design.purities -> list[str]`.
- Produces:
  - schemas `CardPrice`, `PieceCard`, `DesignCard`, `PublicStore`
  - `price_now(piece: Jewellery, ctx: PricingContext) -> PiecePrice`
  - `piece_card(piece: Jewellery, price: PiecePrice) -> PieceCard`
  - `design_card(design: Design) -> DesignCard`
  - `router` in `app/routers/public.py` with prefix `/api/public`
  - test helper `published_design(client, auth, **changes) -> str` in `tests/test_public.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_public.py`:

```python
from tests.test_designs import DESIGN, jpeg


def published_design(client, auth, **changes) -> str:
    """Create a design with one photo and publish it. Returns its public id."""
    body = {**DESIGN, **changes}
    pid = client.post("/api/designs", json=body, headers=auth).json()["public_id"]
    res = client.post(f"/api/designs/{pid}/photos", files={"file": ("d.jpg", jpeg(), "image/jpeg")}, headers=auth)
    assert res.status_code == 201, res.text
    res = client.put(f"/api/designs/{pid}", json={**body, "is_published": True}, headers=auth)
    assert res.status_code == 200, res.text
    return pid


# ---------- Store page ----------

def test_store_page_lists_visible_pieces_sold_last(client, auth, payload, publish):
    first = publish(title="First")
    sold = publish(title="Sold one", stock_status="sold")
    reserved = publish(title="Reserved one", stock_status="reserved")
    newest = publish(title="Newest")
    client.post("/api/jewellery", json=payload, headers=auth)  # a draft
    gone = publish(title="Gone")
    assert client.delete(f"/api/jewellery/{gone['jewellery_id']}", headers=auth).status_code == 200

    res = client.get("/api/public/stores/test-store")
    assert res.status_code == 200, res.text
    body = res.json()
    assert [p["jewellery_id"] for p in body["pieces"]] == [
        newest["jewellery_id"], reserved["jewellery_id"], first["jewellery_id"], sold["jewellery_id"],
    ]
    card = body["pieces"][0]
    assert set(card) == {"jewellery_id", "title", "type", "purity", "net_weight", "stock_status", "cover", "price"}
    assert card["cover"]["public_id"] == newest["photos"][0]["public_id"]
    assert body["name"] == "Test Jewellers" and body["hours"] == "Daily 10 am - 8 pm" and body["phone"] is None
    for private in ("id", "status", "piece_count", "design_count", "created_at", "updated_at"):
        assert private not in body


def test_store_page_lists_published_designs_newest_first(client, auth):
    client.post("/api/designs", json=DESIGN, headers=auth)  # a draft
    older = published_design(client, auth, title="Older")
    newer = published_design(client, auth, title="Newer")

    designs = client.get("/api/public/stores/test-store").json()["designs"]
    assert [d["public_id"] for d in designs] == [newer, older]
    assert set(designs[0]) == {"public_id", "title", "category", "purity_options", "weight_min", "weight_max",
                               "price_min", "price_max", "cover"}
    assert designs[0]["cover"] is not None and designs[0]["purity_options"] == ["22K", "18K"]


def test_store_page_unknown_and_inactive(client, auth):
    res = client.get("/api/public/stores/nowhere")
    assert res.status_code == 404 and res.json() == {"detail": "Store not found"}
    assert client.get("/api/public/stores/TEST-STORE").status_code == 200  # typed in another case

    client.post("/api/stores/test-store/deactivate", headers=auth)
    res = client.get("/api/public/stores/test-store")
    assert res.status_code == 410 and res.json() == {"detail": "Store no longer listed"}


def test_card_prices_match_the_piece_page(client, publish):
    deal = publish(title="Deal", discount_type="percent", discount_value="10")
    sold = publish(title="Sold deal", stock_status="sold", discount_type="percent", discount_value="10")

    cards = {c["jewellery_id"]: c["price"] for c in client.get("/api/public/stores/test-store").json()["pieces"]}
    for piece in (deal, sold):
        page = client.get(f"/api/verify/{piece['verification_token']}").json()["price"]
        card = cards[piece["jewellery_id"]]
        for key in ("final_min", "final_max", "original_min", "original_max"):
            assert card[key] == page[key], key
        assert card["discount_label"] == (page["discount"]["label"] if page["discount"] else None)
    assert cards[deal["jewellery_id"]]["discount_label"] == "10% off"
    assert cards[sold["jewellery_id"]]["discount_label"] is None  # a sold piece shows no discount
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && python -m pytest tests/test_public.py -q`
Expected: 4 failed, each with `assert 404 == 200` or a `KeyError`/404 body, because `/api/public/...` doesn't exist.

- [ ] **Step 3: Add the schemas**

In `backend/app/schemas.py`, directly above `class PublicVerification(BaseModel):`, add:

```python
# ---------- Public pages ----------

class CardPrice(BaseModel):
    """A piece's price as a card shows it: the same numbers as its page, without the breakdown."""

    final_min: Decimal
    final_max: Decimal
    original_min: Decimal
    original_max: Decimal
    discount_label: str | None


class PieceCard(BaseModel):
    jewellery_id: str
    title: str
    type: str
    purity: str
    net_weight: Decimal
    stock_status: StockStatus
    cover: PhotoOut | None
    price: CardPrice


class DesignCard(BaseModel):
    """Never carries a Jewellery ID or verification level: a design is not a verified piece."""

    public_id: str
    title: str
    category: str
    purity_options: list[str]
    weight_min: Decimal
    weight_max: Decimal
    price_min: Decimal
    price_max: Decimal
    cover: PhotoOut | None


class PublicStore(StoreRef):
    address: str
    latitude: Decimal
    longitude: Decimal
    phone: str | None
    whatsapp: str | None
    hours: str
    photos: list[PhotoOut]
    pieces: list[PieceCard]
    designs: list[DesignCard]
```

- [ ] **Step 4: Add the card builders**

Create `backend/app/services/cards.py`:

```python
"""The shapes buyers see in lists: a store's pieces and designs, similar pieces, and later search."""
from app.models import Design, Jewellery
from app.schemas import CardPrice, DesignCard, PieceCard, PiecePrice
from app.services.photos import photo_out
from app.services.pricing import PricingContext, piece_price


def price_now(piece: Jewellery, ctx: PricingContext) -> PiecePrice:
    return piece_price(piece, ctx.rate, ctx.gst_percent, ctx.today)


def piece_card(piece: Jewellery, price: PiecePrice) -> PieceCard:
    return PieceCard(
        jewellery_id=piece.jewellery_id,
        title=piece.title,
        type=piece.type,
        purity=piece.purity,
        net_weight=piece.net_weight,
        stock_status=piece.stock_status,
        cover=photo_out(piece.photos[0], piece.title) if piece.photos else None,
        price=CardPrice(
            final_min=price.final_min,
            final_max=price.final_max,
            original_min=price.original_min,
            original_max=price.original_max,
            discount_label=price.discount.label if price.discount else None,
        ),
    )


def design_card(design: Design) -> DesignCard:
    return DesignCard(
        public_id=design.public_id,
        title=design.title,
        category=design.category,
        purity_options=design.purities,
        weight_min=design.weight_min,
        weight_max=design.weight_max,
        price_min=design.price_min,
        price_max=design.price_max,
        cover=photo_out(design.photos[0], design.title) if design.photos else None,
    )
```

- [ ] **Step 5: Add the router**

Create `backend/app/routers/public.py`:

```python
"""Pages buyers open without logging in: a store, and (in this router) a design. Read-only."""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Design, Jewellery, Store
from app.schemas import PublicStore
from app.services.cards import design_card, piece_card, price_now
from app.services.photos import photo_out
from app.services.pricing import pricing_context

router = APIRouter(prefix="/api/public", tags=["public pages"])

Slug = Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9\-]+$")
SOLD_LAST = case((Jewellery.stock_status == "sold", 1), else_=0)


@router.get(
    "/stores/{slug}",
    response_model=PublicStore,
    responses={404: {"description": "No such store"}, 410: {"description": "Store inactive"}},
)
def store_page(slug: str = Slug, db: Session = Depends(get_db)) -> PublicStore:
    store = db.scalar(select(Store).where(Store.slug == slug.lower()))
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    if store.status != "active":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Store no longer listed")

    pieces = db.scalars(
        select(Jewellery)
        .where(Jewellery.store_id == store.id, Jewellery.is_published.is_(True), Jewellery.status == "active")
        .order_by(SOLD_LAST, Jewellery.created_at.desc(), Jewellery.id.desc())
    ).all()
    designs = db.scalars(
        select(Design)
        .where(Design.store_id == store.id, Design.is_published.is_(True))
        .order_by(Design.created_at.desc(), Design.id.desc())
    ).all()
    ctx = pricing_context(db)

    return PublicStore(
        slug=store.slug,
        name=store.name,
        area=store.area,
        city=store.city,
        address=store.address,
        latitude=store.latitude,
        longitude=store.longitude,
        phone=store.phone,
        whatsapp=store.whatsapp,
        hours=store.hours,
        photos=[photo_out(p, store.name) for p in store.photos],
        pieces=[piece_card(p, price_now(p, ctx)) for p in pieces],
        designs=[design_card(d) for d in designs],
    )
```

In `backend/app/main.py`, change the router import to
`from app.routers import auth, designs, jewellery, photos, public, settings as settings_router, stores, verify`
and add `app.include_router(public.router)` after `app.include_router(verify.router)`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_public.py -q`
Expected: `4 passed`

- [ ] **Step 7: Run the whole suite and commit**

Run: `cd backend && python -m pytest -q`
Expected: all pass (148 before this task, 152 now).

```bash
git add backend/app/schemas.py backend/app/services/cards.py backend/app/routers/public.py backend/app/main.py backend/tests/test_public.py
git commit -m "Add the public store page endpoint with piece and design cards"
```

---

### Task 2: The public design endpoint

**Files:**
- Modify: `backend/app/schemas.py` (add `PublicDesign` after `PublicStore`)
- Modify: `backend/app/routers/public.py`
- Modify: `backend/tests/test_public.py`

**Interfaces:**
- Consumes: `published_design(client, auth, **changes) -> str` (Task 1 test helper); `photo_out`; `StoreRef`.
- Produces: schema `PublicDesign`; `GET /api/public/designs/{public_id}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_public.py`:

```python
# ---------- Design page ----------

def test_design_page(client, auth):
    pid = published_design(client, auth)
    res = client.get(f"/api/public/designs/{pid.lower()}")  # typed in another case
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["public_id"] == pid and body["title"] == "Temple necklace"
    assert body["store"] == {"slug": "test-store", "name": "Test Jewellers", "area": "Test Area", "city": "Mumbai"}
    assert body["purity_options"] == ["22K", "18K"]
    assert (body["making_days_min"], body["making_days_max"]) == (14, 21)
    assert len(body["photos"]) == 1
    for absent in ("jewellery_id", "verification_level", "is_published", "id", "created_at", "updated_at"):
        assert absent not in body


def test_design_page_hides_drafts_and_inactive_stores(client, auth):
    draft = client.post("/api/designs", json=DESIGN, headers=auth).json()["public_id"]
    for pid in (draft, "DSN0000000"):
        res = client.get(f"/api/public/designs/{pid}")
        assert res.status_code == 404 and res.json() == {"detail": "Design not found"}

    pid = published_design(client, auth)
    client.post("/api/stores/test-store/deactivate", headers=auth)
    res = client.get(f"/api/public/designs/{pid}")
    assert res.status_code == 410 and res.json() == {"detail": "Design no longer listed"}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && python -m pytest tests/test_public.py -q -k design_page`
Expected: 2 failed (`assert 404 == 200` in the first; wrong detail `{"detail": "Not Found"}` in the second).

- [ ] **Step 3: Add the schema**

In `backend/app/schemas.py`, after `class PublicStore`, add:

```python
class PublicDesign(BaseModel):
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
    photos: list[PhotoOut]
```

- [ ] **Step 4: Add the endpoint**

In `backend/app/routers/public.py`, import `PublicDesign` and `StoreRef` alongside `PublicStore`
(`from app.schemas import PublicDesign, PublicStore, StoreRef`), add below `Slug`:

```python
DesignId = Path(min_length=4, max_length=12, pattern=r"^[A-Za-z0-9]+$")
```

and append:

```python
@router.get(
    "/designs/{public_id}",
    response_model=PublicDesign,
    responses={404: {"description": "No such design"}, 410: {"description": "Store inactive"}},
)
def design_page(public_id: str = DesignId, db: Session = Depends(get_db)) -> PublicDesign:
    design = db.scalar(select(Design).where(Design.public_id == public_id.upper()))
    if design is None or not design.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")
    if design.store.status != "active":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Design no longer listed")

    return PublicDesign(
        public_id=design.public_id,
        store=StoreRef.model_validate(design.store),
        title=design.title,
        description=design.description,
        category=design.category,
        purity_options=design.purities,
        weight_min=design.weight_min,
        weight_max=design.weight_max,
        price_min=design.price_min,
        price_max=design.price_max,
        making_days_min=design.making_days_min,
        making_days_max=design.making_days_max,
        photos=[photo_out(p, design.title) for p in design.photos],
    )
```

Also update the module docstring to: `"""Pages buyers open without logging in: a store and a design. Read-only."""`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_public.py -q`
Expected: `6 passed`

- [ ] **Step 6: Run the whole suite and commit**

Run: `cd backend && python -m pytest -q`
Expected: all pass (154).

```bash
git add backend/app/schemas.py backend/app/routers/public.py backend/tests/test_public.py
git commit -m "Add the public design page endpoint"
```

---

### Task 3: Similar pieces on the verify response

**Files:**
- Create: `backend/app/services/similar.py`
- Modify: `backend/app/schemas.py` (`PublicVerification` gains `similar`)
- Modify: `backend/app/routers/verify.py`
- Modify: `backend/tests/test_public.py`
- Modify: `README.md` (API summary table, section 7)

**Interfaces:**
- Consumes: `price_now`, `piece_card` (Task 1); `PieceCard` schema (Task 1).
- Produces: `similar_pieces(db: Session, piece: Jewellery, price: PiecePrice, ctx: PricingContext) -> list[PieceCard]`;
  `PublicVerification.similar: list[PieceCard]`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_public.py` (add `from tests.test_stores import STORE` to the imports at the top):

```python
# ---------- Similar pieces ----------
# The payload is a 22K Ring at a registered price of 125000 (no gold rate in tests). Within ±30%: 87500-162500.

def similar_ids(client, piece) -> list[str]:
    res = client.get(f"/api/verify/{piece['verification_token']}")
    assert res.status_code == 200, res.text
    return [c["jewellery_id"] for c in res.json()["similar"]]


def test_similar_pieces_rank_by_category_then_purity_then_price(client, publish):
    me = publish()
    a = publish(title="Ring, 22K, near")                                      # 4 + 2 + 1 = 7
    b = publish(title="Ring, 18K, near", purity="18K")                        # 4 + 1 = 5
    c = publish(title="Ring, 22K, far", gold_value="500000")                  # 4 + 2 = 6
    d = publish(title="Necklace, 22K, near", type="Necklace")                 # 2 + 1 = 3
    e = publish(title="Necklace, 18K, same price", type="Necklace", purity="18K")                     # 1, gap 0
    g = publish(title="Necklace, 18K, a bit dearer", type="Necklace", purity="18K", gold_value="103500")  # 1, gap 5000
    publish(title="Necklace, 18K, far", type="Necklace", purity="18K", gold_value="500000")         # 0: left out

    assert similar_ids(client, me) == [x["jewellery_id"] for x in (a, c, b, d, e, g)]


def test_similar_pieces_leave_out_what_a_buyer_cant_buy_here(client, auth, payload, publish):
    me = publish()
    keep = publish(title="Keep")
    publish(title="Sold", stock_status="sold")
    client.post("/api/jewellery", json=payload, headers=auth)  # a draft
    gone = publish(title="Gone")
    client.delete(f"/api/jewellery/{gone['jewellery_id']}", headers=auth)
    other_store = client.post("/api/stores", json=STORE, headers=auth).json()["slug"]
    publish(title="Elsewhere", store=other_store)

    assert similar_ids(client, me) == [keep["jewellery_id"]]
    assert similar_ids(client, keep) == [me["jewellery_id"]]  # never the piece itself


def test_similar_pieces_empty_and_capped_at_eight(client, publish):
    me = publish()
    assert similar_ids(client, me) == []

    for i in range(9):
        publish(title=f"Ring {i}")
    ids = similar_ids(client, me)
    assert len(ids) == 8 and me["jewellery_id"] not in ids
    assert client.get(f"/api/verify/{ids[0]}").status_code == 200  # cards link by Jewellery ID
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && python -m pytest tests/test_public.py -q -k similar`
Expected: 3 failed with `KeyError: 'similar'`.

- [ ] **Step 3: Add the service**

Create `backend/app/services/similar.py`:

```python
"""Similar pieces for a piece page: from the same store only, ranked by how closely they match."""
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Jewellery
from app.schemas import PieceCard, PiecePrice
from app.services.cards import piece_card, price_now
from app.services.pricing import PricingContext

LIMIT = 8
PRICE_BAND = Decimal("0.30")  # "a similar price": within 30% either way


def _mid(price: PiecePrice) -> Decimal:
    return (price.final_min + price.final_max) / 2


def similar_pieces(db: Session, piece: Jewellery, price: PiecePrice, ctx: PricingContext) -> list[PieceCard]:
    """Same category counts most, then purity, then price. A piece matching on none of them isn't similar."""
    candidates = db.scalars(
        select(Jewellery).where(
            Jewellery.store_id == piece.store_id,
            Jewellery.id != piece.id,
            Jewellery.is_published.is_(True),
            Jewellery.status == "active",
            Jewellery.stock_status != "sold",
        )
    ).all()

    mid = _mid(price)
    ranked = []
    for other in candidates:
        other_price = price_now(other, ctx)
        gap = abs(_mid(other_price) - mid)
        score = (4 if other.type == piece.type else 0) + (2 if other.purity == piece.purity else 0)
        score += 1 if gap <= PRICE_BAND * mid else 0
        if score:
            ranked.append((-score, gap, other.jewellery_id, other, other_price))
    ranked.sort(key=lambda row: row[:3])
    return [piece_card(other, other_price) for *_, other, other_price in ranked[:LIMIT]]
```

- [ ] **Step 4: Return it from verify**

In `backend/app/schemas.py`, add one field at the end of `PublicVerification`, after `price: PiecePrice`:

```python
    similar: list[PieceCard]  # up to 8 from the same store; empty is normal
```

In `backend/app/routers/verify.py`:
- add imports `from app.services.cards import price_now` and `from app.services.similar import similar_pieces`;
- after `lab = item.verification_level == "lab"`, add `price = price_now(item, ctx)`;
- replace `price=piece_price(item, ctx.rate, ctx.gst_percent, ctx.today),` with
  ```python
        price=price,
        similar=similar_pieces(db, item, price, ctx),
  ```
- change the pricing import to `from app.services.pricing import gold_rate_out, pricing_context` (`piece_price`
  is no longer used here).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_public.py -q`
Expected: `9 passed`

- [ ] **Step 6: Document the endpoints**

In `README.md` section 7's table, replace the `/api/verify/{token}` row with:

```markdown
| GET | `/api/verify/{token}` | public | Buyer view: store, photos, verification level, live gold rate, price and up to 8 similar pieces from the same store. `404` not found or unpublished, `410` inactive (no details returned) |
| GET | `/api/public/stores/{slug}` | public | Store page: details, photos, its pieces (sold last) and designs as cards. `404` unknown, `410` inactive |
| GET | `/api/public/designs/{public_id}` | public | Design page. `404` unknown or unpublished, `410` store inactive |
```

- [ ] **Step 7: Run the whole suite and commit**

Run: `cd backend && python -m pytest -q`
Expected: all pass (157).

```bash
git add backend/app/services/similar.py backend/app/schemas.py backend/app/routers/verify.py backend/tests/test_public.py README.md
git commit -m "Add similar pieces from the same store to the piece page"
```

---

### Task 4: Frontend types, service, loader, gallery and card tiles

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/services/public.ts`
- Modify: `frontend/src/utils/format.ts`
- Create: `frontend/src/hooks/usePublicRecord.ts`
- Create: `frontend/src/components/public/Gallery.tsx`
- Create: `frontend/src/components/public/PieceTile.tsx`
- Create: `frontend/src/components/public/DesignTile.tsx`
- Create: `frontend/src/components/public/Unavailable.tsx`

**Interfaces:**
- Consumes: API shapes from Tasks 1–3; `photoService.url(id, "thumb" | "full")`; `request`, `ApiError`,
  `errorMessage` from `@/services/api`; `formatINRRange`, `formatWeight` from `@/utils/format`.
- Produces:
  - types `CardPrice`, `PieceCard`, `DesignCard`, `PublicStore`, `PublicDesign`; `PublicVerification.similar: PieceCard[]`
  - `publicService.store(slug, signal?) -> Promise<PublicStore>`, `publicService.design(id, signal?) -> Promise<PublicDesign>`
  - `formatWeightRange(min, max): string`, `formatDaysRange(min, max): string`
  - `usePublicRecord<T>(key: string, load: (signal: AbortSignal) => Promise<T>) -> { state: LoadState<T>; retry: () => void }`
    with `LoadState<T> = {kind:"loading"} | {kind:"found"; data:T} | {kind:"not-found"} | {kind:"gone"} | {kind:"error"; message:string}`
  - components `Gallery({ photos, sizes?, className? })`, `PieceTile({ piece })`, `DesignTile({ design })`,
    `Unavailable({ title, body, onRetry? })`

- [ ] **Step 1: Add the types**

In `frontend/src/types/index.ts`, add `similar: PieceCard[];` as the last field of `interface PublicVerification`,
and append:

```ts
/** A piece's price on a card: the same numbers as its page, without the breakdown. */
export interface CardPrice {
  final_min: DecimalString;
  final_max: DecimalString;
  original_min: DecimalString;
  original_max: DecimalString;
  discount_label: string | null;
}

export interface PieceCard {
  jewellery_id: string;
  title: string;
  type: JewelleryType;
  purity: Purity;
  net_weight: DecimalString;
  stock_status: StockStatus;
  cover: Photo | null;
  price: CardPrice;
}

/** Never carries a Jewellery ID or verification level: a design is not a verified piece. */
export interface DesignCard {
  public_id: string;
  title: string;
  category: JewelleryType;
  purity_options: Purity[];
  weight_min: DecimalString;
  weight_max: DecimalString;
  price_min: DecimalString;
  price_max: DecimalString;
  cover: Photo | null;
}

export interface PublicStore extends StoreRef {
  address: string;
  latitude: DecimalString;
  longitude: DecimalString;
  phone: string | null;
  whatsapp: string | null;
  hours: string;
  photos: Photo[];
  pieces: PieceCard[];
  designs: DesignCard[];
}

export interface PublicDesign {
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
  photos: Photo[];
}
```

- [ ] **Step 2: Add the service and format helpers**

Create `frontend/src/services/public.ts`:

```ts
import { request } from "./api";
import type { PublicDesign, PublicStore } from "@/types";

export const publicService = {
  store: (slug: string, signal?: AbortSignal) =>
    request<PublicStore>(`/api/public/stores/${encodeURIComponent(slug)}`, { auth: false, signal }),
  design: (id: string, signal?: AbortSignal) =>
    request<PublicDesign>(`/api/public/designs/${encodeURIComponent(id)}`, { auth: false, signal }),
};
```

Append to `frontend/src/utils/format.ts`:

```ts
/** 30.00 – 45.00 g, or one weight when both ends match. */
export function formatWeightRange(min: string | number, max: string | number): string {
  return Number(min) === Number(max) ? formatWeight(min) : `${formatWeight(min).slice(0, -2)} – ${formatWeight(max)}`;
}

/** 14–21 days, or "7 days" when both ends match. */
export function formatDaysRange(min: number, max: number): string {
  return min === max ? `${min} ${min === 1 ? "day" : "days"}` : `${min}–${max} days`;
}
```

- [ ] **Step 3: Add the loader hook**

Create `frontend/src/hooks/usePublicRecord.ts`:

```ts
import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/services/api";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "found"; data: T }
  | { kind: "not-found" }
  | { kind: "gone" }
  | { kind: "error"; message: string };

/** Loads one public record by key: 404 (or a malformed key, 422) is "not found", 410 is "gone". */
export function usePublicRecord<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    load(controller.signal)
      .then((data) => setState({ kind: "found", data }))
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) setState({ kind: "not-found" });
        else if (err instanceof ApiError && err.status === 410) setState({ kind: "gone" });
        else setState({ kind: "error", message: errorMessage(err, "Check your connection and try again.") });
      });
    return () => controller.abort();
    // `load` is recreated every render; the key and the retry count are what decide a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
```

- [ ] **Step 4: Add the gallery**

Create `frontend/src/components/public/Gallery.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { photoService } from "@/services/photos";
import type { Photo } from "@/types";
import { cn } from "@/utils/cn";

interface GalleryProps {
  photos: Photo[];
  /** How wide a slide is on screen, so the browser picks the 600 or 1600 px image. */
  sizes?: string;
  className?: string;
}

/** Swipeable photos. CSS scroll-snap does the swiping; buttons, dots and arrow keys step through on desktop. */
export function Gallery({ photos, sizes = "(min-width: 1024px) 560px, 100vw", className }: GalleryProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const many = photos.length > 1;

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    }
  };

  return (
    <div className={cn("relative", className)} role="region" aria-roledescription="carousel" aria-label="Photos">
      <div
        ref={track}
        onScroll={onScroll}
        onKeyDown={many ? onKeyDown : undefined}
        tabIndex={many ? 0 : undefined}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-md border border-line bg-chalk [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <div
            key={photo.public_id}
            className="w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`Photo ${i + 1} of ${photos.length}`}
          >
            <img
              src={photoService.url(photo.public_id, "thumb")}
              srcSet={`${photoService.url(photo.public_id, "thumb")} 600w, ${photoService.url(photo.public_id, "full")} 1600w`}
              sizes={sizes}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        ))}
      </div>

      {many && (
        <>
          {(["prev", "next"] as const).map((dir) => {
            const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
            const disabled = dir === "prev" ? index === 0 : index === photos.length - 1;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => go(index + (dir === "prev" ? -1 : 1))}
                disabled={disabled}
                aria-label={dir === "prev" ? "Previous photo" : "Next photo"}
                className={cn(
                  "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md transition-opacity hover:bg-white disabled:opacity-0 sm:grid",
                  dir === "prev" ? "left-3" : "right-3",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </button>
            );
          })}
          <div className="mt-3 flex justify-center gap-1.5">
            {photos.map((photo, i) => (
              <button
                key={photo.public_id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-gold-deep" : "w-1.5 bg-line-strong")}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Photo {index + 1} of {photos.length}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the tiles and the unavailable panel**

Create `frontend/src/components/public/PieceTile.tsx`:

```tsx
import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { photoService } from "@/services/photos";
import { STOCK_LABEL, type PieceCard } from "@/types";
import { formatINRRange, formatWeight } from "@/utils/format";

/** A piece in a list. Links by Jewellery ID, so the QR token never appears in a list. */
export function PieceTile({ piece }: { piece: PieceCard }) {
  const { cover, price } = piece;
  return (
    <Link to={`/verify/${piece.jewellery_id}`} className="group block min-w-0">
      <div className="relative overflow-hidden rounded-md border border-line bg-chalk">
        {cover ? (
          <img
            src={photoService.url(cover.public_id, "thumb")}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-muted">
            <ImageOff className="size-6" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {piece.stock_status !== "in_stock" && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-ink">
            {STOCK_LABEL[piece.stock_status]}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{piece.title}</p>
      <p className="text-[13px] text-muted">
        {piece.purity} · {formatWeight(piece.net_weight)}
      </p>
      <p className="tabular mt-1 text-[15px] font-semibold text-ink">{formatINRRange(price.final_min, price.final_max)}</p>
      {price.discount_label && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
          <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
          <span className="rounded-full bg-gold-bright/20 px-1.5 text-[11px] font-semibold text-gold-deep">{price.discount_label}</span>
        </p>
      )}
    </Link>
  );
}
```

Create `frontend/src/components/public/DesignTile.tsx`:

```tsx
import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { photoService } from "@/services/photos";
import type { DesignCard } from "@/types";
import { formatINRRange, formatWeightRange } from "@/utils/format";

/** A made-to-order design in a list: always "approx", never a badge or a Jewellery ID. */
export function DesignTile({ design }: { design: DesignCard }) {
  const { cover } = design;
  return (
    <Link to={`/designs/${design.public_id}`} className="group block min-w-0">
      <div className="relative overflow-hidden rounded-md border border-line bg-chalk">
        {cover ? (
          <img
            src={photoService.url(cover.public_id, "thumb")}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-muted">
            <ImageOff className="size-6" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-basalt/90 px-2 py-0.5 text-xs font-semibold text-chalk">
          Made to order
        </span>
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{design.title}</p>
      <p className="text-[13px] text-muted">
        {design.purity_options.join(" / ")} · approx {formatWeightRange(design.weight_min, design.weight_max)}
      </p>
      <p className="tabular mt-1 text-[15px] font-semibold text-ink">
        approx {formatINRRange(design.price_min, design.price_max)}
      </p>
    </Link>
  );
}
```

Create `frontend/src/components/public/Unavailable.tsx`:

```tsx
import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

/** Shown instead of a store or design page that can't be shown. Nothing partial is displayed. */
export function Unavailable({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rise mx-auto max-w-xl px-4 py-12 sm:py-20">
      <div className="rounded-lg border border-line bg-white px-6 py-10 text-center sm:px-10">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-line-strong bg-chalk text-muted">
          <SearchX className="size-6" strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink/80">{body}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-5 text-sm font-medium text-basalt underline-offset-4 hover:underline">
            Try again
          </button>
        )}
      </div>
      <p className="mt-8 text-center text-sm">
        <Link to="/" className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Back to Jewlerify
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Type-check and build**

Run: `cd frontend && npm run build`
Expected: exits 0. (`ease-out-soft` is the theme's `--ease-out-soft` easing, already used by `button.tsx`.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/public.ts frontend/src/utils/format.ts frontend/src/hooks/usePublicRecord.ts frontend/src/components/public
git commit -m "Add the gallery, piece and design tiles and the public page loader"
```

---

### Task 5: Piece page: gallery, store link, similar pieces

**Files:**
- Modify: `frontend/src/pages/VerifyPage.tsx`

**Interfaces:**
- Consumes: `Gallery`, `PieceTile` (Task 4); `PublicVerification.similar` (Task 3/4).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Replace the single photo with the gallery**

In `frontend/src/pages/VerifyPage.tsx`:
- Delete the whole `function ProductPhoto(...)` and the `<ProductPhoto record={record} />` line inside the details
  section's right-hand column (the column keeps the `HallmarkStamp`), and remove the now-unused
  `import { photoService } from "@/services/photos";`.
- Add imports: `import { Gallery } from "@/components/public/Gallery";` and
  `import { PieceTile } from "@/components/public/PieceTile";`.
- Directly after `<ResultBanner record={record} checkedAt={checkedAt} />`, add:

```tsx
        {record.photos.length > 0 && (
          <div className="rise px-5 pt-7 sm:px-8" style={delay(120)}>
            <Gallery photos={record.photos} sizes="(min-width: 1024px) 520px, (min-width: 640px) 560px, 100vw" />
          </div>
        )}
```

- [ ] **Step 2: Link the store tab**

In `ResultBanner`, replace the store tab paragraph's text with a link (keep the paragraph and its classes):

```tsx
      <p className="absolute bottom-0 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-t-lg bg-white px-4 pb-1 pt-3 font-display text-[24px] leading-tight text-ink sm:left-6">
        <span className="sr-only">Store: </span>
        <Link to={`/stores/${record.store.slug}`} className="underline-offset-4 hover:underline">
          {record.store.name}
        </Link>
      </p>
```

- [ ] **Step 3: Add the similar pieces row**

Add this component above `function VerifySkeleton()`:

```tsx
/** Same store only. A scroller on phones, a grid on desktop. Not rendered when there are none. */
function SimilarPieces({ record }: { record: PublicVerification }) {
  if (record.similar.length === 0) return null;
  return (
    <section className="rise mt-10 lg:col-span-2" style={delay(660)} aria-labelledby="similar-heading">
      <div className="px-5 sm:px-0">
        <h2 id="similar-heading" className="font-display text-[24px] leading-tight text-ink">Similar pieces</h2>
        <p className="mt-1 text-sm text-muted">More from {record.store.name}</p>
      </div>
      <div className="mt-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {record.similar.map((piece) => (
          <div key={piece.jewellery_id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-auto">
            <PieceTile piece={piece} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

In `VerifiedRecord`, render it after the gold rate tape block and before the "Verify another item" paragraph:

```tsx
      <SimilarPieces record={record} />
```

- [ ] **Step 4: Type-check and build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 5: Visual check**

Start the local stack (README section 3): `docker compose up -d db`; in `backend`, `uvicorn app.main:app --port 8010`;
in `frontend`, `npm run dev`. In Chrome, open `http://localhost:5173/verify/UWPVS7T9QZR9` (the local Nakshi kada,
which has 2 photos from the Part 1 checks) at 390 px wide and at desktop width, and confirm:
- the gallery swipes (phone) and steps with the buttons and arrow keys (desktop); the dot follows;
- a piece with one photo shows no buttons or dots;
- the store tab links to `/stores/your-store-name`;
- the Similar pieces row appears when there are matches and the page has no horizontal scroll at 390 px.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/VerifyPage.tsx
git commit -m "Show a photo gallery, a store link and similar pieces on the piece page"
```

---

### Task 6: Store page

**Files:**
- Create: `frontend/src/pages/StorePage.tsx`
- Modify: `frontend/src/App.tsx` (route `stores/:slug`)

**Interfaces:**
- Consumes: `publicService.store`, `usePublicRecord`, `Gallery`, `PieceTile`, `DesignTile`, `Unavailable` (Task 4).
- Produces: route `/stores/:slug`.

- [ ] **Step 1: Write the page**

Create `frontend/src/pages/StorePage.tsx`:

```tsx
import { Clock, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { Gallery } from "@/components/public/Gallery";
import { PieceTile } from "@/components/public/PieceTile";
import { Unavailable } from "@/components/public/Unavailable";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";
import type { PublicStore } from "@/types";
import { cn } from "@/utils/cn";

const directionsUrl = (s: PublicStore) =>
  `https://www.google.com/maps/dir/?api=1&destination=${Number(s.latitude)},${Number(s.longitude)}`;

/** OpenStreetMap's own embed: free, no key. The box is about 1 km across, centred on the pin. */
function mapEmbedUrl(s: PublicStore): string {
  const lat = Number(s.latitude);
  const lng = Number(s.longitude);
  const bbox = [lng - 0.006, lat - 0.004, lng + 0.006, lat + 0.004].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function ContactLink({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(buttonVariants({ variant: primary ? "primary" : "secondary", size: "md" }), "flex-1")}
    >
      {icon}
      {children}
    </a>
  );
}

function VisitPanel({ store }: { store: PublicStore }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 sm:p-6">
      <h2 className="text-[13px] font-semibold text-gold-deep">Visit the store</h2>
      <p className="mt-3 flex gap-2.5 text-[15px] leading-relaxed text-ink">
        <MapPin className="mt-1 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        {store.address}
      </p>
      <p className="mt-2 flex gap-2.5 text-[15px] leading-relaxed text-ink">
        <Clock className="mt-1 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        {store.hours}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {store.phone && (
          <ContactLink href={`tel:${store.phone}`} icon={<Phone />} primary>
            Call
          </ContactLink>
        )}
        {store.whatsapp && (
          <ContactLink href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} icon={<MessageCircle />}>
            WhatsApp
          </ContactLink>
        )}
        <ContactLink href={directionsUrl(store)} icon={<Navigation />} primary={!store.phone}>
          Directions
        </ContactLink>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-line">
        <iframe
          title={`Map showing ${store.name}`}
          src={mapEmbedUrl(store)}
          loading="lazy"
          className="block aspect-[4/3] w-full"
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] text-muted">
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          OpenStreetMap
        </a>{" "}
        contributors
      </p>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function StoreView({ store }: { store: PublicStore }) {
  const hasPhotos = store.photos.length > 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="rise">
        <p className="text-[13px] font-semibold text-gold-deep">Jewellery store</p>
        <h1 className="mt-1 break-words font-display text-[34px] leading-tight text-ink sm:text-[44px]">{store.name}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {store.area}, {store.city}
        </p>
      </header>

      <div className={cn("rise mt-6 grid gap-6", hasPhotos ? "lg:grid-cols-[1fr_400px] lg:items-start" : "max-w-xl")}>
        {hasPhotos && <Gallery photos={store.photos} sizes="(min-width: 1024px) 680px, 100vw" />}
        <VisitPanel store={store} />
      </div>

      {store.pieces.length > 0 && (
        <section className="mt-12" aria-labelledby="pieces-heading">
          <h2 id="pieces-heading" className="font-display text-[26px] leading-tight text-ink">Pieces</h2>
          <Grid>
            {store.pieces.map((piece) => (
              <PieceTile key={piece.jewellery_id} piece={piece} />
            ))}
          </Grid>
        </section>
      )}

      {store.designs.length > 0 && (
        <section className="mt-12" aria-labelledby="designs-heading">
          <h2 id="designs-heading" className="font-display text-[26px] leading-tight text-ink">Made to order</h2>
          <p className="mt-1 text-sm text-muted">Approximate prices. Final price agreed with the store.</p>
          <Grid>
            {store.designs.map((design) => (
              <DesignTile key={design.public_id} design={design} />
            ))}
          </Grid>
        </section>
      )}

      {store.pieces.length === 0 && store.designs.length === 0 && (
        <p className="mt-12 text-[15px] text-muted">No pieces listed yet.</p>
      )}
    </div>
  );
}

function StoreSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6 sm:py-12" role="status" aria-label="Loading the store">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-64 w-full max-w-xl" />
    </div>
  );
}

export function StorePage() {
  const { slug = "" } = useParams();
  const { state, retry } = usePublicRecord(slug, (signal) => publicService.store(slug, signal));

  useEffect(() => {
    document.title = state.kind === "found" ? `${state.data.name}, ${state.data.area}` : "Store";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <StoreSkeleton />;
    case "found":
      return <StoreView store={state.data} />;
    case "not-found":
      return <Unavailable title="Store not found" body="There's no store at this address. Check the link and try again." />;
    case "gone":
      return <Unavailable title="This store is no longer listed" body="The store has been taken off Jewlerify, so its details aren't shown." />;
    case "error":
      return <Unavailable title="The store could not be loaded" body={state.message} onRetry={retry} />;
  }
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, add `import { StorePage } from "@/pages/StorePage";` with the other public page imports,
and inside the `PublicLayout` route, after the `verify/:token` route:

```tsx
              <Route path="stores/:slug" element={<StorePage />} />
```

- [ ] **Step 3: Type-check and build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Visual check**

With the local stack running, open `http://localhost:5173/stores/your-store-name` at 390 px and desktop width and confirm:
- name, area and city; the gallery (the local store has a photo from the Part 1 checks); address and hours;
- Call shown (local phone is set), WhatsApp hidden (empty), Directions opens Google Maps at the store's coordinates;
- the map loads with a pin and the OpenStreetMap credit;
- Pieces grid in API order, any sold piece last with its label; Made to order grid with the "approx" line;
- long titles truncate; no horizontal page scroll at 390 px;
- `/stores/nowhere` shows "Store not found".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StorePage.tsx frontend/src/App.tsx
git commit -m "Add the public store page"
```

---

### Task 7: Design page

**Files:**
- Create: `frontend/src/pages/DesignPage.tsx`
- Modify: `frontend/src/App.tsx` (route `designs/:id`)

**Interfaces:**
- Consumes: `publicService.design`, `usePublicRecord`, `Gallery`, `Unavailable` (Task 4); `formatINRRange`,
  `formatWeightRange`, `formatDaysRange`.
- Produces: route `/designs/:id`.

- [ ] **Step 1: Write the page**

Create `frontend/src/pages/DesignPage.tsx`:

```tsx
import { ArrowRight, Info } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Gallery } from "@/components/public/Gallery";
import { Unavailable } from "@/components/public/Unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";
import type { PublicDesign } from "@/types";
import { formatDaysRange, formatINRRange, formatWeightRange } from "@/utils/format";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular text-right text-[15px] text-ink">{value}</dd>
    </div>
  );
}

/** Made to order: everything reads "approx", and there's no badge, Jewellery ID or price breakdown. */
function DesignView({ design }: { design: PublicDesign }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-10">
      <Gallery className="rise" photos={design.photos} sizes="(min-width: 1024px) 520px, 100vw" />

      <div className="rise mt-8 lg:mt-0">
        <span className="inline-flex rounded-full bg-basalt px-2.5 py-0.5 text-xs font-semibold text-chalk">Made to order</span>
        <h1 className="mt-3 break-words font-display text-[32px] leading-tight text-ink sm:text-[38px]">{design.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{design.category}</p>

        <p className="mt-6 text-[13px] text-muted">Approximate price</p>
        <p className="tabular font-display text-[28px] leading-tight text-ink">
          approx {formatINRRange(design.price_min, design.price_max)}
        </p>

        <dl className="mt-6">
          <Row label="Weight" value={`approx ${formatWeightRange(design.weight_min, design.weight_max)}`} />
          <Row label="Purity" value={design.purity_options.join(" / ")} />
          <Row label="Making time" value={formatDaysRange(design.making_days_min, design.making_days_max)} />
        </dl>

        {design.description && <p className="mt-5 text-[15px] leading-relaxed text-ink/85">{design.description}</p>}

        <p className="mt-5 flex gap-2.5 rounded-md bg-chalk px-4 py-3 text-[13px] leading-relaxed text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} aria-hidden />
          Approximate price. Final price agreed with the store.
        </p>

        <Link
          to={`/stores/${design.store.slug}`}
          className="group mt-6 flex items-center justify-between gap-4 rounded-lg border border-line bg-white px-5 py-4 transition-colors hover:border-basalt/40"
        >
          <span className="min-w-0">
            <span className="block text-[13px] text-muted">Made by</span>
            <span className="block truncate text-[17px] font-medium text-ink">{design.store.name}</span>
            <span className="block text-[13px] text-muted">
              {design.store.area}, {design.store.city}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function DesignSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[1fr_400px] lg:gap-10" role="status" aria-label="Loading the design">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="mt-8 space-y-4 lg:mt-0">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-56" />
      </div>
    </div>
  );
}

export function DesignPage() {
  const { id = "" } = useParams();
  const { state, retry } = usePublicRecord(id, (signal) => publicService.design(id, signal));

  useEffect(() => {
    document.title = state.kind === "found" ? `${state.data.title}, made to order` : "Design";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <DesignSkeleton />;
    case "found":
      return <DesignView design={state.data} />;
    case "not-found":
      return <Unavailable title="Design not found" body="There's no design at this address. Check the link and try again." />;
    case "gone":
      return <Unavailable title="This design is no longer available" body="The store that makes it is no longer listed on Jewlerify." />;
    case "error":
      return <Unavailable title="The design could not be loaded" body={state.message} onRetry={retry} />;
  }
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, add `import { DesignPage } from "@/pages/DesignPage";` and, after the `stores/:slug` route:

```tsx
              <Route path="designs/:id" element={<DesignPage />} />
```

- [ ] **Step 3: Type-check and build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Visual check (all three pages)**

With the local stack running, open the local published design (from the store page's Made to order grid; the Part 1
checks published "Temple necklace") at 390 px and desktop width and confirm:
- gallery, "Made to order", title, category, "approx" price, weight, purity, making time, description, the note;
- no verification badge, Jewellery ID, gold rate or price breakdown anywhere on the page;
- the store card links to the store page;
- `/designs/DSN0000000` shows "Design not found".

Then re-open the piece page and store page once more at 390 px to confirm the full path piece → store → design → store
works by clicking only.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DesignPage.tsx frontend/src/App.tsx
git commit -m "Add the public design page"
```
