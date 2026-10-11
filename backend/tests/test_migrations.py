"""Migration 0005 on a real file database, with data shaped like production's."""
from io import BytesIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from PIL import Image
from sqlalchemy import create_engine, text

from app.config import get_settings

BACKEND = Path(__file__).resolve().parent.parent
BEFORE = "0004_store_and_live_pricing"


@pytest.fixture()
def migrate(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'migrate.db').as_posix()}"
    monkeypatch.setattr(get_settings(), "database_url", url)  # alembic/env.py reads the URL from settings
    # No ini file: alembic.ini's logging config would otherwise switch off the app's loggers for later tests.
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    engine = create_engine(url)
    yield cfg, engine
    engine.dispose()


def png(size=(300, 400)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, (180, 140, 60)).save(buf, "PNG")
    return buf.getvalue()


def seed_before(engine) -> None:
    with engine.begin() as c:
        c.execute(text("UPDATE store_settings SET store_name = 'Old Name Jewellers' WHERE id = 1"))
        c.execute(text("INSERT INTO certificate_files (name, data) VALUES ('p1.png', :d)"), {"d": png()})
        rows = [
            (1, "Nakshi kada in 22K gold", "Bangle", None, "p1.png"),
            (2, "Wedding band", "Ring", "HM-1", None),
        ]
        for pk, desc, kind, cert, photo in rows:
            c.execute(
                text(
                    "INSERT INTO jewellery (id, jewellery_id, verification_token, type, description, purity,"
                    " gross_weight, net_weight, certificate_id, gold_value, making_charges, other_component_value,"
                    " tax, total_price, status, created_at, updated_at, photo) VALUES (:id, :jid, :tok, :kind, :desc,"
                    " '22K', 10, 10, :cert, 1, 1, 0, 1, 3, 'active', '2026-10-01', '2026-10-01', :photo)"
                ),
                {"id": pk, "jid": f"JWL-26-AAAAA{pk}", "tok": f"TOKEN{pk:07d}", "kind": kind, "desc": desc,
                 "cert": cert, "photo": photo},
            )


def test_upgrade_moves_pieces_onto_a_placeholder_store(migrate):
    cfg, engine = migrate
    command.upgrade(cfg, BEFORE)
    seed_before(engine)
    command.upgrade(cfg, "head")

    with engine.connect() as c:
        store = c.execute(text("SELECT id, slug, name, city, area, phone, whatsapp FROM stores")).one()
        assert (store.slug, store.name, store.city, store.area) == (
            "old-name-jewellers", "Old Name Jewellers", "Mumbai", "Zaveri Bazaar")
        assert store.phone is None and store.whatsapp is None

        pieces = c.execute(text(
            "SELECT store_id, title, verification_level, stock_status, is_published FROM jewellery ORDER BY id"
        )).all()
        assert [(p.title, p.verification_level, p.stock_status, bool(p.is_published)) for p in pieces] == [
            ("Nakshi kada", "declared", "in_stock", True),
            ("Ring", "lab", "in_stock", True),
        ]
        assert {p.store_id for p in pieces} == {store.id}

        photo = c.execute(text("SELECT piece_id, position, alt_text, width, height, image, thumbnail FROM photos")).one()
        assert (photo.piece_id, photo.position, photo.alt_text, photo.width, photo.height) == (1, 0, "", 300, 400)
        assert photo.image.startswith(b"\xff\xd8\xff") and photo.thumbnail.startswith(b"\xff\xd8\xff")
        assert c.execute(text("SELECT count(*) FROM certificate_files")).scalar() == 0


def test_downgrade_restores_the_photo_and_store_name(migrate):
    cfg, engine = migrate
    command.upgrade(cfg, BEFORE)
    seed_before(engine)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, BEFORE)

    with engine.connect() as c:
        assert c.execute(text("SELECT store_name FROM store_settings")).scalar() == "Old Name Jewellers"
        name = c.execute(text("SELECT photo FROM jewellery WHERE id = 1")).scalar()
        assert name and c.execute(
            text("SELECT count(*) FROM certificate_files WHERE name = :n"), {"n": name}).scalar() == 1

    command.upgrade(cfg, "head")  # and back up cleanly


def jpeg_rotated() -> bytes:
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotate 90 degrees clockwise to display
    buf = BytesIO()
    Image.new("RGB", (400, 200), (180, 140, 60)).save(buf, "JPEG", exif=exif.tobytes())
    return buf.getvalue()


def png_transparent() -> bytes:
    buf = BytesIO()
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(buf, "PNG")
    return buf.getvalue()


def test_upgrade_keeps_legacy_photos_upright_and_white_and_survives_a_broken_one(migrate):
    cfg, engine = migrate
    command.upgrade(cfg, BEFORE)
    seed_before(engine)
    with engine.begin() as c:
        files = {"p2.jpg": jpeg_rotated(), "p3.png": png_transparent(), "p4.jpg": b"not an image"}
        for name, data in files.items():
            c.execute(text("INSERT INTO certificate_files (name, data) VALUES (:n, :d)"), {"n": name, "d": data})
        c.execute(text("UPDATE jewellery SET photo = 'p2.jpg' WHERE id = 2"))
        for pk, name in ((3, "p3.png"), (4, "p4.jpg")):
            c.execute(
                text(
                    "INSERT INTO jewellery (id, jewellery_id, verification_token, type, description, purity,"
                    " gross_weight, net_weight, gold_value, making_charges, other_component_value, tax,"
                    " total_price, status, created_at, updated_at, photo) VALUES (:id, :jid, :tok, 'Ring', 'Band',"
                    " '22K', 10, 10, 1, 1, 0, 1, 3, 'active', '2026-10-01', '2026-10-01', :photo)"
                ),
                {"id": pk, "jid": f"JWL-26-AAAAA{pk}", "tok": f"TOKEN{pk:07d}", "photo": name},
            )
    command.upgrade(cfg, "head")

    with engine.connect() as c:
        rows = {r.piece_id: r for r in c.execute(text("SELECT piece_id, width, height, image FROM photos"))}
        assert (rows[2].width, rows[2].height) == (200, 400)  # turned upright, as browsers showed it
        assert min(Image.open(BytesIO(rows[3].image)).getpixel((25, 25))) > 240  # transparent -> white
        assert 4 not in rows
        # the unreadable file isn't deleted, so nothing is lost
        assert c.execute(text("SELECT count(*) FROM certificate_files WHERE name = 'p4.jpg'")).scalar() == 1


def test_rate_limits_table_up_down_up(migrate):
    from sqlalchemy import inspect

    cfg, engine = migrate
    command.upgrade(cfg, "head")
    assert "rate_limits" in inspect(engine).get_table_names()
    command.downgrade(cfg, "0005_marketplace_foundation")
    assert "rate_limits" not in inspect(engine).get_table_names()
    command.upgrade(cfg, "head")
    assert "rate_limits" in inspect(engine).get_table_names()
