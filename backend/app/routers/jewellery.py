from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import PURITY_PERCENT
from app.database import get_db
from app.deps import require_admin
from app.models import Jewellery
from app.schemas import (
    JewelleryIn,
    JewelleryOut,
    JewelleryPage,
    JewelleryStats,
    JewelleryType,
    JewelleryUpdate,
    Purity,
    RecordStatus,
)
from app.services import files
from app.services.identifiers import new_jewellery_id, new_verification_token
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


def to_out(item: Jewellery) -> JewelleryOut:
    return JewelleryOut.model_validate(
        {
            **{c.key: getattr(item, c.key) for c in Jewellery.__table__.columns},
            "verification_url": get_settings().verification_url(item.verification_token),
            "purity_percent": PURITY_PERCENT.get(item.purity, ""),
            "has_certificate_document": bool(item.certificate_document),
            "verification_status": item.verification_status,
        }
    )


def get_or_404(db: Session, jewellery_id: str) -> Jewellery:
    item = db.scalar(select(Jewellery).where(Jewellery.jewellery_id == jewellery_id.upper()))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jewellery record not found")
    return item


def apply_fields(item: Jewellery, body: JewelleryIn) -> None:
    data = body.model_dump(exclude={"total_price", "status"})
    for key, value in data.items():
        setattr(item, key, value)
    item.total_price = body.total_price if body.total_price is not None else body.calculated_total


@router.get("", response_model=JewelleryPage)
def list_jewellery(
    db: Session = Depends(get_db),
    search: str | None = Query(None, max_length=64),
    type: JewelleryType | None = None,
    purity: Purity | None = None,
    status_: RecordStatus | None = Query(None, alias="status"),
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
                func.lower(Jewellery.description).like(term),
            )
        )
    if type:
        query = query.where(Jewellery.type == type)
    if purity:
        query = query.where(Jewellery.purity == purity)
    if status_:
        query = query.where(Jewellery.status == status_)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    column = SORTABLE[sort]
    query = query.order_by(column.asc() if order == "asc" else column.desc(), Jewellery.id.desc())
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return JewelleryPage(items=[to_out(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/stats", response_model=JewelleryStats)
def stats(db: Session = Depends(get_db)) -> JewelleryStats:
    def count(*conditions) -> int:
        return db.scalar(select(func.count(Jewellery.id)).where(*conditions)) or 0

    return JewelleryStats(
        total=count(),
        active=count(Jewellery.status == "active"),
        verified=count(Jewellery.status == "active", Jewellery.certificate_id.is_not(None)),
        inactive=count(Jewellery.status == "inactive"),
    )


@router.post("", response_model=JewelleryOut, status_code=status.HTTP_201_CREATED)
def create_jewellery(body: JewelleryIn, db: Session = Depends(get_db)) -> JewelleryOut:
    item = Jewellery(
        jewellery_id=new_jewellery_id(db),
        verification_token=new_verification_token(db),
        status="active",
    )
    apply_fields(item, body)
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_out(item)


@router.get("/{jewellery_id}", response_model=JewelleryOut)
def get_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    return to_out(get_or_404(db, jewellery_id))


@router.put("/{jewellery_id}", response_model=JewelleryOut)
def update_jewellery(jewellery_id: str, body: JewelleryUpdate, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    apply_fields(item, body)
    if body.status:
        item.status = body.status
    db.commit()
    db.refresh(item)
    return to_out(item)


@router.delete("/{jewellery_id}", response_model=JewelleryOut)
def deactivate_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    """Soft delete: the record is kept, but its QR code no longer verifies."""
    item = get_or_404(db, jewellery_id)
    item.status = "inactive"
    db.commit()
    db.refresh(item)
    return to_out(item)


@router.post("/{jewellery_id}/activate", response_model=JewelleryOut)
def activate_jewellery(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    item.status = "active"
    db.commit()
    db.refresh(item)
    return to_out(item)


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
    files.delete_certificate(db, previous)
    db.commit()
    db.refresh(item)
    return to_out(item)


@router.get("/{jewellery_id}/certificate")
def download_certificate(jewellery_id: str, db: Session = Depends(get_db)) -> Response:
    item = get_or_404(db, jewellery_id)
    if not item.certificate_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No certificate document uploaded")
    suffix = Path(item.certificate_document).suffix
    return Response(
        content=files.load_certificate(db, item.certificate_document),
        media_type=files.MEDIA_TYPES[suffix],
        headers={"Content-Disposition": f'attachment; filename="{item.jewellery_id}-certificate{suffix}"'},
    )


@router.delete("/{jewellery_id}/certificate", response_model=JewelleryOut)
def remove_certificate(jewellery_id: str, db: Session = Depends(get_db)) -> JewelleryOut:
    item = get_or_404(db, jewellery_id)
    files.delete_certificate(db, item.certificate_document)
    item.certificate_document = None
    db.commit()
    db.refresh(item)
    return to_out(item)
