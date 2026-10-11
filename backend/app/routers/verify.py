import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.database import get_db
from app.models import Jewellery
from app.schemas import PublicVerification, StoreRef
from app.services.cards import price_now
from app.services import rate_limit
from app.services.photos import photo_out
from app.services.pricing import gold_rate_out, pricing_context
from app.services.similar import similar_pieces

router = APIRouter(prefix="/api/verify", tags=["public verification"])

Code = Path(min_length=4, max_length=32, pattern=r"^[A-Za-z0-9\-]+$")
VERIFY_WINDOW = timedelta(minutes=1)
VERIFY_LIMIT = 60  # lookups per IP per minute; an open piece page polls once a minute


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
    responses={
        404: {"description": "No such record"},
        410: {"description": "Record inactive"},
        429: {"description": "Too many lookups"},
    },
)
def verify(request: Request, token: str = Code, db: Session = Depends(get_db)) -> PublicVerification:
    """Public endpoint opened from the QR code."""
    verdict = rate_limit.hit(db, "verify-ip", rate_limit.client_ip(request), VERIFY_LIMIT, VERIFY_WINDOW)
    if not verdict.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many lookups. Try again in a minute.",
            headers={"Retry-After": str(verdict.retry_after)},
        )
    if secrets.randbelow(100) == 0:  # about one lookup in a hundred also forgets day-old counts
        rate_limit.purge(db)
    item = visible_piece(db, token)
    ctx = pricing_context(db)
    lab = item.verification_level == "lab"
    price = price_now(item, ctx)

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
        price=price,
        similar=similar_pieces(db, item, price, ctx),
    )
