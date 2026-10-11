from pathlib import Path as FilePath

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.database import get_db
from app.models import Jewellery
from app.schemas import PublicVerification
from app.services import files
from app.services.gold_rate import current_rate
from app.services.pricing import gold_rate_out, live_price
from app.services.store import get_store

router = APIRouter(prefix="/api/verify", tags=["public verification"])

Code = Path(min_length=4, max_length=32, pattern=r"^[A-Za-z0-9\-]+$")


def active_item(db: Session, token: str) -> Jewellery:
    """Accepts the QR token, or the Jewellery ID printed under the QR for buyers who enter it by hand."""
    code = token.strip().upper()
    item = db.scalar(
        select(Jewellery).where(or_(Jewellery.verification_token == code, Jewellery.jewellery_id == code))
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
    if item.status != "active":
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
    item = active_item(db, token)
    store = get_store(db)
    rate = current_rate(db)

    return PublicVerification(
        jewellery_id=item.jewellery_id,
        store_name=store.store_name or None,
        type=item.type,
        description=item.description,
        colour=item.colour,
        design_details=item.design_details,
        photo_version=FilePath(item.photo).stem if item.photo else None,
        purity=item.purity,
        purity_percent=PURITY_PERCENT.get(item.purity, ""),
        gross_weight=item.gross_weight,
        net_weight=item.net_weight,
        certificate_id=item.certificate_id,
        issuing_authority=item.issuing_authority,
        certificate_date=item.certificate_date,
        gold_value=item.gold_value,
        making_charges=item.making_charges,
        other_component_value=item.other_component_value,
        tax=item.tax,
        total_price=item.total_price,
        verification_status=item.verification_status,
        record_status="ACTIVE",
        registered_on=item.created_at.date(),
        gold_rate=gold_rate_out(rate) if rate else None,
        live_price=live_price(item, rate, store.gst_percent) if rate else None,
    )


@router.get("/{token}/photo", responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}})
def verify_photo(token: str = Code, db: Session = Depends(get_db)) -> Response:
    item = active_item(db, token)
    if not item.photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo for this item")
    return Response(
        content=files.load_file(db, item.photo),
        media_type=files.MEDIA_TYPES[FilePath(item.photo).suffix],
        # The page links it with ?v=<photo_version>, so a replaced photo gets a new URL.
        headers={"Cache-Control": "public, max-age=86400"},
    )
