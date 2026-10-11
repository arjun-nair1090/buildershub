import secrets
from datetime import datetime, timezone

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import Design, Jewellery

# Crockford-style alphabet: no 0/O or 1/I/L, so IDs read cleanly off a printed tag.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def _random_code(length: int) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def new_jewellery_id(db: Session) -> str:
    year = datetime.now(timezone.utc).strftime("%y")
    while True:
        candidate = f"JWL-{year}-{_random_code(6)}"
        if not db.scalar(select(exists().where(Jewellery.jewellery_id == candidate))):
            return candidate


def new_verification_token(db: Session) -> str:
    # 12 chars from a 31-symbol alphabet ≈ 59 bits — not guessable, still a compact QR.
    while True:
        candidate = _random_code(12)
        if not db.scalar(select(exists().where(Jewellery.verification_token == candidate))):
            return candidate


def new_design_id(db: Session) -> str:
    # "DSN" + 7: never confused with a Jewellery ID, which designs don't have.
    while True:
        candidate = f"DSN{_random_code(7)}"
        if not db.scalar(select(exists().where(Design.public_id == candidate))):
            return candidate
