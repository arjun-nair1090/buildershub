"""seed.py on a fresh database: one placeholder store and the five pieces, published with photos; safe to rerun."""
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import seed
from app.database import Base
from app.models import Jewellery, Photo, Store, User


def test_seed_is_complete_and_idempotent(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(seed, "SessionLocal", sessionmaker(bind=engine, autoflush=False, expire_on_commit=False))

    seed.seed()
    seed.seed()

    with sessionmaker(bind=engine)() as db:
        assert db.scalar(select(func.count(User.id))) == 1
        [store] = db.scalars(select(Store)).all()
        assert (store.name, store.city, store.area, store.phone) == ("Your Store Name", "Mumbai", "Zaveri Bazaar", None)
        pieces = db.scalars(select(Jewellery)).all()
        assert {p.title for p in pieces} == {"Nakshi kada", "Hollow chain", "Rani haar", "Casting ring",
                                             "Jaguar bracelet"}
        assert all(p.is_published and p.verification_level == "declared" and p.store_id == store.id for p in pieces)
        assert db.scalar(select(func.count(Photo.id))) == 5
