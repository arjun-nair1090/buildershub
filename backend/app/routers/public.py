"""Pages buyers open without logging in: a store and a design. Read-only."""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Design, Jewellery, Store
from app.schemas import PublicDesign, PublicStore, StoreRef
from app.services.cards import design_card, piece_card, price_now
from app.services.photos import photo_out
from app.services.pricing import pricing_context

router = APIRouter(prefix="/api/public", tags=["public pages"])

Slug = Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9\-]+$")
DesignId = Path(min_length=4, max_length=12, pattern=r"^[A-Za-z0-9]+$")
SOLD_LAST = case((Jewellery.stock_status == "sold", 1), else_=0)


def international(number: str | None) -> str | None:
    """wa.me links need the country code. Numbers are stored as digits with an optional leading +, and a
    store may have entered a local Indian mobile ("9820012345" or "09820012345"): those get +91."""
    if not number or number.startswith("+"):
        return number
    digits = number.lstrip("0")
    return f"+91{digits}" if len(digits) == 10 else f"+{digits}"


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
        whatsapp=international(store.whatsapp),
        hours=store.hours,
        photos=[photo_out(p, store.name) for p in store.photos],
        pieces=[piece_card(p, price_now(p, ctx)) for p in pieces],
        designs=[design_card(d) for d in designs],
    )


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
