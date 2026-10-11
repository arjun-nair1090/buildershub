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
