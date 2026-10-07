"""Seed the database with an admin account and demo jewellery records.

Idempotent: the admin is only created if the email is missing, and demo jewellery
is only inserted into an empty table.  Run with:  python seed.py
"""
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Jewellery, User
from app.security import hash_password

D = Decimal
GST = D("0.03")

# (jewellery_id, token, type, description, purity, gross, net, certificate (id, authority, date) | None,
#  gold_value, making, other, tax | None -> 3% GST, status, days_ago)
DEMO = [
    ("JWL-26-A8F72K", "K7Q2M9XRT4HP", "Ring", "22K gold diamond ring with a 0.30 ct solitaire",
     "22K", "16.02", "15.42", ("DEMO-HM-26-014823", "Northgate Assay & Hallmarking Centre", date(2026, 9, 14)),
     "98500", "12000", "4000", "10500", "active", 2),
    ("JWL-26-N4C9TE", "R3XW8D5MZ2QF", "Necklace", "22K gold temple necklace with antique matte finish",
     "22K", "42.80", "41.95", ("DEMO-HM-26-015107", "Northgate Assay & Hallmarking Centre", date(2026, 9, 10)),
     "267980", "38500", "0", None, "active", 5),
    ("JWL-26-B6H3PV", "M9T4KC7WX3NE", "Bracelet", "18K gold Cuban link bracelet, polished",
     "18K", "12.40", "12.10", ("DEMO-HM-26-013992", "Meridian Assay Laboratory", date(2026, 8, 28)),
     "63280", "9200", "0", None, "active", 9),
    ("JWL-26-C2R7MW", "H5PZ2V8QK6RA", "Chain", "22K gold rope chain, 20 inch",
     "22K", "18.25", "18.25", ("DEMO-HM-26-015230", "Northgate Assay & Hallmarking Centre", date(2026, 9, 18)),
     "116580", "11700", "0", None, "active", 12),
    ("JWL-26-E9K5DS", "T2NE6WX4H8MC", "Earrings", "18K gold drop earrings with ruby accents",
     "18K", "6.90", "6.10", ("DEMO-GTL-26-90311", "Meridian Gem Testing Laboratory", date(2026, 8, 30)),
     "31900", "6800", "14500", None, "active", 16),
    ("JWL-26-G8F4XB", "W6CQ3T9MP2KZ", "Bangle", "22K gold bangle pair with hand-finished filigree",
     "22K", "28.60", "28.20", ("DEMO-HM-26-014461", "Northgate Assay & Hallmarking Centre", date(2026, 8, 21)),
     "180140", "24600", "0", None, "active", 21),
    ("JWL-26-P3L8QN", "Z8HM5R2XW7TD", "Pendant", "22K gold Lakshmi pendant with temple motif",
     "22K", "5.35", "5.20", ("DEMO-HM-26-014105", "Northgate Assay & Hallmarking Centre", date(2026, 8, 12)),
     "33220", "4100", "0", None, "active", 27),
    ("JWL-26-R5V2HJ", "P4KD9XN3QW6M", "Ring", "14K gold band, brushed satin finish",
     "14K", "4.10", "4.10", None,
     "16730", "2400", "0", None, "active", 33),
    ("JWL-26-U7W3ZC", "X3RT7KP9MC2W", "Pendant", "24K gold coin pendant, 10 g",
     "24K", "10.00", "10.00", ("DEMO-HM-26-012870", "Meridian Assay Laboratory", date(2026, 7, 29)),
     "69700", "1500", "0", None, "active", 41),
    ("JWL-26-H6Q9YT", "N7WC4M8ZK3RX", "Necklace", "22K gold choker with kundan setting (retired record)",
     "22K", "36.40", "33.90", ("DEMO-HM-26-011764", "Northgate Assay & Hallmarking Centre", date(2026, 7, 2)),
     "216550", "32000", "22500", None, "inactive", 58),
]


def money(value: str | Decimal) -> Decimal:
    return D(value).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def seed() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        email = settings.seed_admin_email.strip().lower()
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(
                name=settings.seed_admin_name,
                email=email,
                password_hash=hash_password(settings.seed_admin_password),
                role="admin",
                status="active",
            ))
            print(f"Created admin user {email}")

        if db.scalar(select(func.count(Jewellery.id))):
            print("Jewellery table already has data; skipping demo records.")
        else:
            now = datetime.now(timezone.utc)
            for (jid, token, jtype, desc, purity, gross, net, cert, gold, making, other, tax,
                 status, days_ago) in DEMO:
                gold, making, other = money(gold), money(making), money(other)
                # GST rounded to whole rupees, as on a typical retail bill.
                tax = money(tax) if tax else money((gold + making + other) * GST).quantize(D("1"), rounding=ROUND_HALF_UP)
                created = now - timedelta(days=days_ago, hours=days_ago % 7)
                db.add(Jewellery(
                    jewellery_id=jid,
                    verification_token=token,
                    type=jtype,
                    description=desc,
                    purity=purity,
                    gross_weight=D(gross),
                    net_weight=D(net),
                    certificate_id=cert[0] if cert else None,
                    issuing_authority=cert[1] if cert else None,
                    certificate_date=cert[2] if cert else None,
                    gold_value=gold,
                    making_charges=making,
                    other_component_value=other,
                    tax=tax,
                    total_price=gold + making + other + tax,
                    status=status,
                    created_at=created,
                    updated_at=created,
                ))
            print(f"Inserted {len(DEMO)} demo jewellery records")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
