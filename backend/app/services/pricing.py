from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from sqlalchemy.orm import Session

from app.constants import PURITY_PERCENT
from app.schemas import GoldRateOut, PiecePrice, PriceDiscount
from app.services.gold_rate import RateSnapshot, current_rate
from app.services.store import get_store_settings

HUNDRED = Decimal("100")
# India has one time zone and no daylight saving, so a fixed offset is exact (and needs no tz database).
IST = timezone(timedelta(hours=5, minutes=30), "IST")
MAX_DISCOUNT_PERCENT = Decimal("90")


def _rupees(value: Decimal) -> Decimal:
    # Live amounts move with the market, so paise would only be noise.
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def karat_rate(inr_per_gram_24k: Decimal, purity: str) -> Decimal:
    """Rate per gram of gold at this purity: 22K is 91.6% of the pure-gold rate."""
    return (inr_per_gram_24k * Decimal(PURITY_PERCENT[purity]) / HUNDRED).quantize(Decimal("0.01"), ROUND_HALF_UP)


def gold_rate_out(rate: RateSnapshot) -> GoldRateOut:
    change = None
    if rate.previous:
        change = ((rate.inr_per_gram_24k - rate.previous) / rate.previous * HUNDRED).quantize(Decimal("0.01"))
    return GoldRateOut(
        per_gram={k: karat_rate(rate.inr_per_gram_24k, k) for k in PURITY_PERCENT},
        change_percent=change,
        updated_at=rate.fetched_at,
        source=rate.source,
    )


def today_ist() -> date:
    return datetime.now(IST).date()


def format_inr(amount: Decimal) -> str:
    """₹1,25,000: whole rupees, Indian digit grouping."""
    digits = str(abs(int(_rupees(Decimal(amount)))))
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return "₹" + ",".join([*groups, tail])


def discount_label(kind: str, value: Decimal) -> str:
    if kind == "percent":
        return f"{format(Decimal(value).normalize(), 'f')}% off"
    return f"{format_inr(value)} off"


class Priceable(Protocol):
    purity: str
    net_weight: Decimal
    gold_value: Decimal
    making_charges: Decimal
    other_component_value: Decimal
    tax: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    discount_type: str | None
    discount_value: Decimal | None
    discount_ends_on: date | None
    stock_status: str
    updated_at: datetime


def _discount_applies(piece: Priceable, today: date) -> bool:
    return (
        piece.discount_type is not None
        and piece.discount_value is not None
        and piece.stock_status != "sold"
        and (piece.discount_ends_on is None or piece.discount_ends_on >= today)
    )


def _discount_amount(piece: Priceable, original: Decimal) -> Decimal:
    if piece.discount_type == "percent":
        amount = _rupees(original * piece.discount_value / HUNDRED)
    else:
        amount = _rupees(piece.discount_value)
    return min(amount, _rupees(original * MAX_DISCOUNT_PERCENT / HUNDRED))


def piece_price(piece: Priceable, rate: RateSnapshot | None, gst_percent: Decimal, today: date) -> PiecePrice:
    """The one place prices are worked out, so every page shows the same numbers."""
    if rate is not None:
        per_gram = karat_rate(rate.inr_per_gram_24k, piece.purity)
        gold = _rupees(piece.net_weight * per_gram)
        ranged = piece.making_percent_min is not None and piece.making_percent_max is not None
        if ranged:
            making_min = _rupees(gold * piece.making_percent_min / HUNDRED)
            making_max = _rupees(gold * piece.making_percent_max / HUNDRED)
        else:
            making_min = making_max = _rupees(piece.making_charges)
        other = _rupees(piece.other_component_value)
        tax_min = _rupees((gold + making_min + other) * gst_percent / HUNDRED)
        tax_max = _rupees((gold + making_max + other) * gst_percent / HUNDRED)
        basis, as_of = "live", rate.fetched_at
    else:
        # No rate has ever been fetched: the registered amounts are the price.
        per_gram, ranged = None, False
        gold = _rupees(piece.gold_value)
        making_min = making_max = _rupees(piece.making_charges)
        other = _rupees(piece.other_component_value)
        tax_min = tax_max = _rupees(piece.tax)
        basis, as_of = "registered", piece.updated_at

    original_min = gold + making_min + other + tax_min
    original_max = gold + making_max + other + tax_max

    discount = None
    final_min, final_max = original_min, original_max
    if _discount_applies(piece, today):
        amount_min = _discount_amount(piece, original_min)
        amount_max = _discount_amount(piece, original_max)
        discount = PriceDiscount(
            type=piece.discount_type,
            value=piece.discount_value,
            label=discount_label(piece.discount_type, piece.discount_value),
            amount_min=amount_min,
            amount_max=amount_max,
            ends_on=piece.discount_ends_on,
        )
        final_min, final_max = original_min - amount_min, original_max - amount_max

    return PiecePrice(
        basis=basis,
        as_of=as_of,
        rate_per_gram=per_gram,
        gold=gold,
        making_min=making_min,
        making_max=making_max,
        making_percent_min=piece.making_percent_min if ranged else None,
        making_percent_max=piece.making_percent_max if ranged else None,
        other=other,
        gst_percent=gst_percent,
        tax_min=tax_min,
        tax_max=tax_max,
        original_min=original_min,
        original_max=original_max,
        discount=discount,
        final_min=final_min,
        final_max=final_max,
    )


@dataclass
class PricingContext:
    """What every price on a request shares: one rate lookup, the store-wide GST, today's date."""

    rate: RateSnapshot | None
    gst_percent: Decimal
    today: date


def pricing_context(db: Session) -> PricingContext:
    return PricingContext(rate=current_rate(db), gst_percent=get_store_settings(db).gst_percent, today=today_ist())
