from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.database import get_db
from app.models import Jewellery
from app.schemas import PublicVerification

router = APIRouter(prefix="/api/verify", tags=["public verification"])


@router.get(
    "/{token}",
    response_model=PublicVerification,
    responses={404: {"description": "No such record"}, 410: {"description": "Record inactive"}},
)
def verify(
    token: str = Path(min_length=4, max_length=32, pattern=r"^[A-Za-z0-9\-]+$"),
    db: Session = Depends(get_db),
) -> PublicVerification:
    """Public endpoint opened from the QR code. Accepts the QR token, or the Jewellery ID
    printed under the QR for buyers who enter it by hand."""
    code = token.strip().upper()
    item = db.scalar(
        select(Jewellery).where(or_(Jewellery.verification_token == code, Jewellery.jewellery_id == code))
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
    if item.status != "active":
        # No jewellery details are returned for inactive records.
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Record inactive")

    return PublicVerification(
        jewellery_id=item.jewellery_id,
        type=item.type,
        description=item.description,
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
    )
