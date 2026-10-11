"""Seed the database with an admin account and the store's jewellery.

Idempotent: the admin is only created if the email is missing, and each piece is only inserted
if its Jewellery ID isn't there yet. Records from the old demo data set are removed.
Run with:  python seed.py
"""
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from sqlalchemy import delete, select

from app.config import get_settings
from app.database import SessionLocal
from app.models import CertificateFile, Jewellery, User
from app.security import hash_password
from app.services.store import get_store_settings

D = Decimal
GST = D("0.03")
PHOTOS = Path(__file__).resolve().parent / "seed_photos"

# 22K rate per gram used for the registered (billed) amounts. Buyers see the live market price
# whenever a gold rate API key is set; these figures are the fallback.
REGISTERED_RATE_22K = D("13700")  # IBJA 22K, 11 Oct 2026

# (jewellery_id, token, type, description, colour, design details, purity, weight (g),
#  making charges range in % of gold value, photo, days_ago)
# The weights on the tags are used as both gross and net gold weight. Correct them from Edit if a
# piece's gross weight differs (stones, strap).
PRODUCTS = [
    ("JWL-26-B2TPBR", "UWPVS7T9QZR9", "Bangle", "Nakshi kada in 22K gold",
     "Yellow gold",
     "Hand-engraved nakshi work with twin lion-head clasp and red stone eyes, ribbed body and leaf-pattern border.",
     "22K", "25.940", ("14", "18"), "nakshi-kada.jpg", 1),
    ("JWL-26-C7HWNK", "PHY5GUC34N8U", "Chain", "Hollow chain in 22K gold",
     "Yellow gold",
     "Lightweight hollow links woven in a twisted rope pattern.",
     "22K", "8.850", ("8", "12"), "hollow-chain.jpg", 2),
    ("JWL-26-RF3D4S", "2HGN47ZX72WF", "Necklace", "Rani haar in 22K gold with a peacock pendant",
     "Yellow gold",
     "Round peacock pendant with red, green and blue enamel, floral centrepiece with stone accents, "
     "teardrop charm and fine chain sides.",
     "22K", "10.760", ("12", "16"), "rani-haar.jpg", 3),
    ("JWL-26-ABKUCR", "T3CMCQCGXRFB", "Ring", "Casting ring in 22K gold",
     "Yellow gold",
     "Square signet face with a red enamel monogram on a textured ground, Greek key border and engraved shoulders.",
     "22K", "4.880", ("10", "14"), "casting-ring.jpg", 4),
    ("JWL-26-EMQXKD", "YDYXKM846872", "Bracelet", "Jaguar bracelet in 22K gold",
     "Yellow gold",
     "Twin interlocking jaguars set with white stones and green enamel spots, on a black rubber strap.",
     "22K", "6.140", ("12", "16"), "jaguar-bracelet.jpg", 5),
]

# Jewellery IDs of the sample records shipped with earlier versions.
OLD_DEMO_IDS = [
    "JWL-26-A8F72K", "JWL-26-N4C9TE", "JWL-26-B6H3PV", "JWL-26-C2R7MW", "JWL-26-E9K5DS",
    "JWL-26-G8F4XB", "JWL-26-P3L8QN", "JWL-26-R5V2HJ", "JWL-26-U7W3ZC", "JWL-26-H6Q9YT",
]


def rupees(value: Decimal) -> Decimal:
    return value.quantize(D("1"), rounding=ROUND_HALF_UP)


def remove_old_demo(db) -> None:
    old = db.scalars(select(Jewellery).where(Jewellery.jewellery_id.in_(OLD_DEMO_IDS))).all()
    for item in old:
        for name in (item.certificate_document, item.photo):
            if name:
                db.execute(delete(CertificateFile).where(CertificateFile.name == name))
        db.delete(item)
    if old:
        print(f"Removed {len(old)} old demo records")


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

        remove_old_demo(db)
        get_store_settings(db)

        existing = set(db.scalars(select(Jewellery.jewellery_id)))
        now = datetime.now(timezone.utc)
        added = 0
        for (jid, token, jtype, desc, colour, design, purity, weight, (pmin, pmax), photo,
             days_ago) in PRODUCTS:
            if jid in existing:
                continue
            gold = rupees(D(weight) * REGISTERED_RATE_22K)
            making = rupees(gold * (D(pmin) + D(pmax)) / 2 / 100)
            tax = rupees((gold + making) * GST)
            photo_name = f"seed-{jid.lower()}.jpg"
            db.merge(CertificateFile(name=photo_name, data=(PHOTOS / photo).read_bytes()))
            created = now - timedelta(days=days_ago)
            db.add(Jewellery(
                jewellery_id=jid,
                verification_token=token,
                type=jtype,
                description=desc,
                colour=colour,
                design_details=design,
                photo=photo_name,
                purity=purity,
                gross_weight=D(weight),
                net_weight=D(weight),
                gold_value=gold,
                making_charges=making,
                other_component_value=D("0"),
                tax=tax,
                total_price=gold + making + tax,
                making_percent_min=D(pmin),
                making_percent_max=D(pmax),
                status="active",
                created_at=created,
                updated_at=created,
            ))
            added += 1
        print(f"Inserted {added} jewellery records" if added else "Jewellery already seeded")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
