import os
import tempfile

# Configure before the app is imported: isolated DB, throwaway upload dir, fixed secret.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="jtvs-uploads-")
os.environ["PUBLIC_BASE_URL"] = "https://verify.example.com"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import hash_password

ADMIN_EMAIL = "admin@test.demo"
ADMIN_PASSWORD = "Secret@123"


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with TestSession() as db:
        db.add(User(name="Admin", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role="admin"))
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
def auth(client):
    res = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def payload():
    return {
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
