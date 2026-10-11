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
