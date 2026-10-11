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
