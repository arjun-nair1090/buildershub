from decimal import ROUND_HALF_UP, Decimal

from app.constants import PURITY_PERCENT
from app.models import Jewellery
from app.schemas import GoldRateOut, LivePrice
from app.services.gold_rate import RateSnapshot

HUNDRED = Decimal("100")


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


def live_price(item: Jewellery, rate: RateSnapshot, gst_percent: Decimal) -> LivePrice:
    per_gram = karat_rate(rate.inr_per_gram_24k, item.purity)
    gold = _rupees(item.net_weight * per_gram)

    if item.making_percent_min is not None and item.making_percent_max is not None:
        making_min = _rupees(gold * item.making_percent_min / HUNDRED)
        making_max = _rupees(gold * item.making_percent_max / HUNDRED)
    else:
        making_min = making_max = item.making_charges

    other = item.other_component_value
    tax_min = _rupees((gold + making_min + other) * gst_percent / HUNDRED)
    tax_max = _rupees((gold + making_max + other) * gst_percent / HUNDRED)

    return LivePrice(
        rate_per_gram=per_gram,
        gold_value=gold,
        making_charges_min=making_min,
        making_charges_max=making_max,
        making_percent_min=item.making_percent_min,
        making_percent_max=item.making_percent_max,
        other_component_value=other,
        gst_percent=gst_percent,
        tax_min=tax_min,
        tax_max=tax_max,
        total_min=gold + making_min + other + tax_min,
        total_max=gold + making_max + other + tax_max,
    )
