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
