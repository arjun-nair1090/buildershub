import os

# Configure before the app is imported: isolated DB, fixed secret.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["PUBLIC_BASE_URL"] = "https://verify.example.com"
os.environ["GOLDAPI_KEY"] = ""  # tests that need a rate enable it explicitly
os.environ["METALS_DEV_API_KEY"] = ""

import secrets
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Jewellery, Photo, Store, User
from app.security import hash_password

ADMIN_EMAIL = "admin@test.demo"
ADMIN_PASSWORD = "Secret@123"
TEST_STORE = "test-store"


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with TestSession() as db:
        db.add(User(name="Admin", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role="admin"))
        db.add(Store(
            slug=TEST_STORE, name="Test Jewellers", address="1 Test Road", area="Test Area", city="Mumbai",
            latitude=Decimal("18.95"), longitude=Decimal("72.83"), hours="Daily 10 am - 8 pm", status="active",
        ))
        db.commit()

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def db(client):
    """A session on the test database, for arranging state the API can't set directly."""
    session = next(app.dependency_overrides[get_db]())
    yield session
    session.close()


@pytest.fixture()
def auth(client):
    res = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def payload():
    return {
        "store": TEST_STORE,
        "title": "Diamond ring",
        "type": "Ring",
        "description": "22K gold diamond ring",
        "purity": "22K",
        "gross_weight": "16.02",
        "net_weight": "15.42",
        "certificate_id": "DEMO-HM-1",
        "issuing_authority": "Test Assay Centre",
        "certificate_date": "2026-01-10",
        "gold_value": "98500",
        "making_charges": "12000",
        "other_component_value": "4000",
        "tax": "10500",
    }


@pytest.fixture()
def add_photo(db):
    """Attach a placeholder photo row to a piece without going through the upload API."""
    def add(jewellery_id: str) -> None:
        piece = db.scalar(select(Jewellery).where(Jewellery.jewellery_id == jewellery_id))
        db.add(Photo(public_id=secrets.token_hex(16), piece_id=piece.id, position=len(piece.photos), alt_text="",
                     image=b"image", thumbnail=b"thumb", width=4, height=3))
        db.commit()
        db.expire_all()
    return add


@pytest.fixture()
def publish(client, auth, payload, add_photo):
    """Create a piece with a photo and publish it. Returns the admin record."""
    def make(**overrides) -> dict:
        body = {**payload, **overrides}
        created = client.post("/api/jewellery", json=body, headers=auth)
        assert created.status_code == 201, created.text
        jid = created.json()["jewellery_id"]
        add_photo(jid)
        res = client.put(f"/api/jewellery/{jid}", json={**body, "is_published": True}, headers=auth)
        assert res.status_code == 200, res.text
        return res.json()
    return make
