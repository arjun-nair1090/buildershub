"""Seed the database with an admin account, the store and its jewellery.

Idempotent: the admin is only created if the email is missing, the store only if there are no stores,
and each piece only if its Jewellery ID isn't there yet.
Run with:  python seed.py
"""
import secrets
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Jewellery, Photo, Store, User
from app.security import hash_password
from app.services.photos import process_image
from app.services.store import get_store_settings

D = Decimal
GST = D("0.03")
PHOTOS = Path(__file__).resolve().parent / "seed_photos"

# 22K rate per gram used for the registered (billed) amounts. Buyers see the live market price
# whenever a gold rate API key is set; these figures are the fallback.
REGISTERED_RATE_22K = D("13700")  # IBJA 22K, 11 Oct 2026

# Placeholder details until the team edits the store in admin. Phone and WhatsApp stay empty rather
# than holding a made-up number that might belong to someone.
STORE = {
    "slug": "your-store-name",
    "name": "Your Store Name",
    "address": "Placeholder address, Zaveri Bazaar, Mumbai",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": D("18.951700"),
    "longitude": D("72.833100"),
    "hours": "Placeholder: Mon-Sat 11 am - 8 pm",
}

# (jewellery_id, token, type, title, description, colour, design details, purity, weight (g),
#  making charges range in % of gold value, photo, days_ago)
# The weights on the tags are used as both gross and net gold weight. Correct them from Edit if a
# piece's gross weight differs (stones, strap).
PRODUCTS = [
    ("JWL-26-B2TPBR", "UWPVS7T9QZR9", "Bangle", "Nakshi kada", "Nakshi kada in 22K gold",
     "Yellow gold",
     "Hand-engraved nakshi work with twin lion-head clasp and red stone eyes, ribbed body and leaf-pattern border.",
     "22K", "25.940", ("14", "18"), "nakshi-kada.jpg", 1),
    ("JWL-26-C7HWNK", "PHY5GUC34N8U", "Chain", "Hollow chain", "Hollow chain in 22K gold",
     "Yellow gold",
     "Lightweight hollow links woven in a twisted rope pattern.",
     "22K", "8.850", ("8", "12"), "hollow-chain.jpg", 2),
    ("JWL-26-RF3D4S", "2HGN47ZX72WF", "Necklace", "Rani haar", "Rani haar in 22K gold with a peacock pendant",
     "Yellow gold",
     "Round peacock pendant with red, green and blue enamel, floral centrepiece with stone accents, "
     "teardrop charm and fine chain sides.",
     "22K", "10.760", ("12", "16"), "rani-haar.jpg", 3),
    ("JWL-26-ABKUCR", "T3CMCQCGXRFB", "Ring", "Casting ring", "Casting ring in 22K gold",
     "Yellow gold",
     "Square signet face with a red enamel monogram on a textured ground, Greek key border and engraved shoulders.",
     "22K", "4.880", ("10", "14"), "casting-ring.jpg", 4),
    ("JWL-26-EMQXKD", "YDYXKM846872", "Bracelet", "Jaguar bracelet", "Jaguar bracelet in 22K gold",
     "Yellow gold",
     "Twin interlocking jaguars set with white stones and green enamel spots, on a black rubber strap.",
     "22K", "6.140", ("12", "16"), "jaguar-bracelet.jpg", 5),
]


def rupees(value: Decimal) -> Decimal:
    return value.quantize(D("1"), rounding=ROUND_HALF_UP)


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

        get_store_settings(db)
        store = db.scalar(select(Store).order_by(Store.id))
        if store is None:
            store = Store(**STORE, status="active")
            db.add(store)
            db.flush()
            print(f"Created store {store.name}")

        existing = set(db.scalars(select(Jewellery.jewellery_id)))
        now = datetime.now(timezone.utc)
        added = 0
        for (jid, token, jtype, title, desc, colour, design, purity, weight, (pmin, pmax), photo,
             days_ago) in PRODUCTS:
            if jid in existing:
                continue
            gold = rupees(D(weight) * REGISTERED_RATE_22K)
            making = rupees(gold * (D(pmin) + D(pmax)) / 2 / 100)
            tax = rupees((gold + making) * GST)
            image = process_image((PHOTOS / photo).read_bytes())
            created = now - timedelta(days=days_ago)
            db.add(Jewellery(
                jewellery_id=jid,
                verification_token=token,
                store=store,
                title=title,
                type=jtype,
                description=desc,
                colour=colour,
                design_details=design,
                purity=purity,
                gross_weight=D(weight),
                net_weight=D(weight),
                verification_level="declared",
                gold_value=gold,
                making_charges=making,
                other_component_value=D("0"),
                tax=tax,
                total_price=gold + making + tax,
                making_percent_min=D(pmin),
                making_percent_max=D(pmax),
                stock_status="in_stock",
                is_published=True,
                status="active",
                created_at=created,
                updated_at=created,
                photos=[Photo(
                    public_id=secrets.token_hex(16),
                    position=0,
                    alt_text="",
                    image=image.image,
                    thumbnail=image.thumbnail,
                    width=image.width,
                    height=image.height,
                )],
            ))
            added += 1
        print(f"Inserted {added} jewellery records" if added else "Jewellery already seeded")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
