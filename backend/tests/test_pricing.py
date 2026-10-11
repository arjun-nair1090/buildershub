from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D

import pytest

from app.services.gold_rate import RateSnapshot
from app.services.pricing import format_inr, piece_price

FETCHED = datetime(2026, 10, 11, 5, 0, tzinfo=timezone.utc)
RATE = RateSnapshot(inr_per_gram_24k=D("10000"), previous=None, fetched_at=FETCHED, source="test")
TODAY = date(2026, 10, 11)
GST = D("3")


@dataclass
class Piece:
    purity: str = "22K"
    net_weight: D = D("10")
    gold_value: D = D("90000")
    making_charges: D = D("9000")
    other_component_value: D = D("1000")
    tax: D = D("3000")
    making_percent_min: D | None = D("10")
    making_percent_max: D | None = D("15")
    discount_type: str | None = None
    discount_value: D | None = None
    discount_ends_on: date | None = None
    stock_status: str = "in_stock"
    updated_at: datetime = datetime(2026, 10, 1, tzinfo=timezone.utc)


def test_live_price_without_discount():
    p = piece_price(Piece(), RATE, GST, TODAY)
    assert p.basis == "live" and p.as_of == FETCHED
    assert p.rate_per_gram == D("9160.00")
    assert p.gold == 91600
    assert (p.making_min, p.making_max) == (9160, 13740)
    assert (p.making_percent_min, p.making_percent_max) == (D("10"), D("15"))
    assert (p.tax_min, p.tax_max) == (3053, 3190)
    assert (p.original_min, p.original_max) == (104813, 109530)
    assert p.discount is None
    assert (p.final_min, p.final_max) == (104813, 109530)


def test_fixed_making_when_no_range():
    p = piece_price(Piece(making_percent_min=None, making_percent_max=None), RATE, GST, TODAY)
    assert (p.making_min, p.making_max) == (9000, 9000)
    assert (p.making_percent_min, p.making_percent_max) == (None, None)
    assert p.original_min == p.original_max == 91600 + 9000 + 1000 + 3048


def test_percent_discount():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10.00")), RATE, GST, TODAY)
    assert p.discount.label == "10% off" and p.discount.type == "percent"
    assert (p.discount.amount_min, p.discount.amount_max) == (10481, 10953)
    assert (p.final_min, p.final_max) == (94332, 98577)


def test_flat_discount():
    p = piece_price(Piece(discount_type="flat", discount_value=D("5000")), RATE, GST, TODAY)
    assert p.discount.label == "₹5,000 off"
    assert (p.final_min, p.final_max) == (99813, 104530)


def test_discount_capped_at_90_percent():
    p = piece_price(Piece(discount_type="flat", discount_value=D("200000")), RATE, GST, TODAY)
    assert (p.discount.amount_min, p.discount.amount_max) == (94332, 98577)
    assert (p.final_min, p.final_max) == (10481, 10953)


def test_expired_discount_is_ignored():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), discount_ends_on=TODAY - timedelta(days=1)),
                    RATE, GST, TODAY)
    assert p.discount is None and p.final_min == p.original_min


def test_discount_ending_today_still_applies():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), discount_ends_on=TODAY), RATE, GST, TODAY)
    assert p.discount is not None and p.discount.ends_on == TODAY


def test_sold_piece_shows_no_discount():
    p = piece_price(Piece(discount_type="percent", discount_value=D("10"), stock_status="sold"), RATE, GST, TODAY)
    assert p.discount is None


def test_registered_fallback_without_a_rate():
    piece = Piece(discount_type="percent", discount_value=D("10"))
    p = piece_price(piece, None, GST, TODAY)
    assert p.basis == "registered" and p.as_of == piece.updated_at and p.rate_per_gram is None
    assert (p.gold, p.making_min, p.making_max, p.other, p.tax_min) == (90000, 9000, 9000, 1000, 3000)
    assert (p.making_percent_min, p.making_percent_max) == (None, None)
    assert p.original_min == p.original_max == 103000
    assert p.final_min == p.final_max == 92700


@pytest.mark.parametrize("weight", ["0.5", "4.88", "10.76", "25.94", "123.456"])
@pytest.mark.parametrize("rate", ["9999.99", "13687.82", "14943.02"])
@pytest.mark.parametrize("discount", [None, ("percent", "7.5"), ("flat", "1234.56")])
def test_lines_add_up(weight, rate, discount):
    piece = Piece(net_weight=D(weight), other_component_value=D("1234.56"))
    if discount:
        piece.discount_type, piece.discount_value = discount[0], D(discount[1])
    p = piece_price(piece, RateSnapshot(D(rate), None, FETCHED, "test"), GST, TODAY)
    for end in ("min", "max"):
        original = getattr(p, f"original_{end}")
        assert p.gold + getattr(p, f"making_{end}") + p.other + getattr(p, f"tax_{end}") == original
        amount = getattr(p.discount, f"amount_{end}") if p.discount else 0
        final = getattr(p, f"final_{end}")
        assert original - amount == final
        assert final == final.to_integral_value()


@pytest.mark.parametrize("amount, text", [
    (D("0"), "₹0"), (D("999"), "₹999"), (D("5000"), "₹5,000"),
    (D("125000"), "₹1,25,000"), (D("12345678.40"), "₹1,23,45,678"),
])
def test_format_inr(amount, text):
    assert format_inr(amount) == text
