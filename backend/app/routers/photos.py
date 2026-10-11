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
