from decimal import Decimal

import pytest

from tests.conftest import ADMIN_EMAIL

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


# ---------- Auth ----------

def test_login_success_and_me(client, auth):
    res = client.get("/api/auth/me", headers=auth)
    assert res.status_code == 200
    assert res.json() == {"name": "Admin", "email": ADMIN_EMAIL, "role": "admin"}
    assert "password_hash" not in res.text


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"})
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post("/api/auth/login", json={"email": "ghost@test.demo", "password": "x"})
    assert res.status_code == 401


def test_login_validation(client):
    res = client.post("/api/auth/login", json={"email": "not-an-email", "password": ""})
    assert res.status_code == 422
    assert "email" in res.json()["fields"]


def test_logout_revokes_token(client, auth):
    assert client.post("/api/auth/logout", headers=auth).status_code == 204
    assert client.get("/api/auth/me", headers=auth).status_code == 401
    login = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "Secret@123"})
    fresh = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=fresh).status_code == 200


def test_admin_routes_require_auth(client):
    assert client.get("/api/jewellery").status_code == 401
    assert client.post("/api/jewellery", json={}).status_code == 401
    assert client.get("/api/jewellery/stats").status_code == 401
    bad = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/api/jewellery", headers=bad).status_code == 401
    assert client.get("/api/auth/admins").status_code == 401
    assert client.post("/api/auth/admins", json={}).status_code == 401


def test_admin_creates_admin(client, auth):
    new = {"name": "Second Admin", "email": " Second@Test.demo ", "password": "Strong-pass-1"}
    res = client.post("/api/auth/admins", json=new, headers=auth)
    assert res.status_code == 201
    assert res.json()["email"] == "second@test.demo" and "password_hash" not in res.json()

    # The new admin can sign in and sees both accounts.
    login = client.post("/api/auth/login", json={"email": "second@test.demo", "password": "Strong-pass-1"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    emails = [a["email"] for a in client.get("/api/auth/admins", headers=headers).json()]
    assert emails == [ADMIN_EMAIL, "second@test.demo"]

    assert client.post("/api/auth/admins", json=new, headers=auth).status_code == 409
    weak = {**new, "email": "third@test.demo", "password": "short"}
    assert client.post("/api/auth/admins", json=weak, headers=auth).status_code == 422


def test_reset_password_and_remove_admin(client, auth):
    other = {"name": "Other", "email": "other@test.demo", "password": "Original-pass-1"}
    client.post("/api/auth/admins", json=other, headers=auth)

    def login(password):
        return client.post("/api/auth/login", json={"email": "other@test.demo", "password": password})

    url = "/api/auth/admins/other@test.demo"
    old_headers = {"Authorization": f"Bearer {login('Original-pass-1').json()['access_token']}"}
    assert client.put(f"{url}/password", json={"password": "short"}, headers=auth).status_code == 422
    assert client.get("/api/auth/me", headers=old_headers).status_code == 200  # rejected reset changes nothing
    assert client.put(f"{url}/password", json={"password": "Brand-new-pass-2"}, headers=auth).status_code == 204
    assert login("Original-pass-1").status_code == 401
    assert client.get("/api/auth/me", headers=old_headers).status_code == 401  # reset signs out old sessions
    other_headers = {"Authorization": f"Bearer {login('Brand-new-pass-2').json()['access_token']}"}

    # Nobody can remove themselves, so at least one admin always remains.
    assert client.delete(f"/api/auth/admins/{ADMIN_EMAIL}", headers=auth).status_code == 400

    assert client.delete(url, headers=auth).status_code == 204
    assert login("Brand-new-pass-2").status_code == 401
    assert client.get("/api/auth/me", headers=other_headers).status_code == 401  # existing session is cut off
    assert client.delete(url, headers=auth).status_code == 404
    assert client.put(f"{url}/password", json={"password": "Brand-new-pass-2"}).status_code == 401


# ---------- CRUD ----------

def test_create_calculates_total_and_ids(client, auth, payload):
    res = client.post("/api/jewellery", json=payload, headers=auth)
    assert res.status_code == 201, res.text
    body = res.json()
    assert Decimal(body["total_price"]) == Decimal("125000")
    assert body["jewellery_id"].startswith("JWL-")
    assert len(body["verification_token"]) == 12
    assert body["verification_url"] == f"https://verify.example.com/verify/{body['verification_token']}"
    assert body["verification_status"] == "VERIFIED"
    assert body["purity_percent"] == "91.6"
    assert "id" not in body


def test_manual_total_override(client, auth, payload):
    res = client.post("/api/jewellery", json={**payload, "total_price": "124999.50"}, headers=auth)
    assert Decimal(res.json()["total_price"]) == Decimal("124999.50")


def test_create_validation(client, auth, payload):
    res = client.post("/api/jewellery", json={**payload, "net_weight": "20"}, headers=auth)
    assert res.status_code == 422
    assert "Net gold weight" in res.json()["detail"]

    res = client.post("/api/jewellery", json={**payload, "purity": "30K", "gold_value": "-1"}, headers=auth)
    assert res.status_code == 422
    assert {"purity", "gold_value"} <= set(res.json()["fields"])

    res = client.post("/api/jewellery", json={**payload, "certificate_id": ""}, headers=auth)
    assert res.status_code == 422  # authority given without certificate id


def test_registered_without_certificate(client, auth, payload):
    no_cert = {**payload, "certificate_id": None, "issuing_authority": None, "certificate_date": None}
    body = client.post("/api/jewellery", json=no_cert, headers=auth).json()
    assert body["verification_status"] == "REGISTERED"


def test_get_update_and_search(client, auth, payload):
    created = client.post("/api/jewellery", json=payload, headers=auth).json()
    jid = created["jewellery_id"]

    assert client.get(f"/api/jewellery/{jid}", headers=auth).json()["description"] == payload["description"]
    assert client.get("/api/jewellery/JWL-00-NOPE00", headers=auth).status_code == 404

    res = client.put(f"/api/jewellery/{jid}", json={**payload, "making_charges": "13000"}, headers=auth)
    assert res.status_code == 200
    assert Decimal(res.json()["total_price"]) == Decimal("126000")
    assert res.json()["verification_token"] == created["verification_token"]  # QR stays valid

    client.post("/api/jewellery", json={**payload, "type": "Bangle", "certificate_id": "OTHER-9"}, headers=auth)
    for term, expected in [(jid, 1), ("demo-hm", 1), ("bangle", 1), ("", 2)]:
        page = client.get("/api/jewellery", params={"search": term}, headers=auth).json()
        assert page["total"] == expected, term

    page = client.get("/api/jewellery", params={"type": "Bangle"}, headers=auth).json()
    assert [i["type"] for i in page["items"]] == ["Bangle"]

    page = client.get("/api/jewellery", params={"sort": "total_price", "order": "asc", "page_size": 1}, headers=auth)
    assert page.json()["page_size"] == 1 and len(page.json()["items"]) == 1


def test_deactivate_and_stats(client, auth, payload):
    a = client.post("/api/jewellery", json=payload, headers=auth).json()
    client.post("/api/jewellery", json={**payload, "certificate_id": None, "issuing_authority": None,
                                        "certificate_date": None}, headers=auth)
    res = client.delete(f"/api/jewellery/{a['jewellery_id']}", headers=auth)
    assert res.json()["status"] == "inactive"
    assert client.get("/api/jewellery/stats", headers=auth).json() == {
        "total": 2, "active": 1, "verified": 0, "inactive": 1,
    }
    res = client.post(f"/api/jewellery/{a['jewellery_id']}/activate", headers=auth)
    assert res.json()["status"] == "active"


# ---------- Public verification ----------

def test_public_verify_valid(client, auth, payload):
    created = client.post("/api/jewellery", json=payload, headers=auth).json()
    res = client.get(f"/api/verify/{created['verification_token']}")
    assert res.status_code == 200
    body = res.json()
    assert body["jewellery_id"] == created["jewellery_id"]
    assert body["verification_status"] == "VERIFIED"
    assert body["record_status"] == "ACTIVE"
    for private in ("verification_token", "certificate_document", "id", "status", "updated_at"):
        assert private not in body

    # The printed Jewellery ID also works for manual entry, case-insensitively.
    assert client.get(f"/api/verify/{created['jewellery_id'].lower()}").status_code == 200


def test_public_verify_invalid(client):
    res = client.get("/api/verify/DOESNOTEXIST")
    assert res.status_code == 404
    assert res.json()["detail"] == "Verification record not found"
    assert client.get("/api/verify/bad%20token!").status_code == 422


def test_public_verify_inactive_hides_details(client, auth, payload):
    created = client.post("/api/jewellery", json=payload, headers=auth).json()
    client.delete(f"/api/jewellery/{created['jewellery_id']}", headers=auth)
    res = client.get(f"/api/verify/{created['verification_token']}")
    assert res.status_code == 410
    assert res.json() == {"detail": "Record inactive"}


# ---------- QR ----------

def test_qr_png(client, auth, payload):
    jid = client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]
    res = client.get(f"/api/jewellery/{jid}/qr", headers=auth)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(b"\x89PNG")
    assert f"{jid}-qr.png" in res.headers["content-disposition"]

    from io import BytesIO

    from PIL import Image

    width, _ = Image.open(BytesIO(res.content)).size
    assert width >= 1000  # print resolution
    assert client.get(f"/api/jewellery/{jid}/qr").status_code == 401


# ---------- Certificate upload ----------

def test_certificate_upload_flow(client, auth, payload):
    jid = client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]
    url = f"/api/jewellery/{jid}/certificate"

    res = client.post(url, files={"file": ("cert.png", PNG_1PX, "image/png")}, headers=auth)
    assert res.status_code == 200
    assert res.json()["has_certificate_document"] is True

    res = client.get(url, headers=auth)
    assert res.status_code == 200 and res.content == PNG_1PX

    res = client.delete(url, headers=auth)
    assert res.json()["has_certificate_document"] is False
    assert client.get(url, headers=auth).status_code == 404


def test_certificate_upload_rejects_bad_files(client, auth, payload):
    jid = client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]
    url = f"/api/jewellery/{jid}/certificate"

    res = client.post(url, files={"file": ("evil.exe", b"MZ...", "application/octet-stream")}, headers=auth)
    assert res.status_code == 422
    # Right extension and MIME type, wrong contents.
    res = client.post(url, files={"file": ("fake.pdf", b"MZ not a pdf", "application/pdf")}, headers=auth)
    assert res.status_code == 422


def test_photo_upload_flow(client, auth, payload):
    created = client.post("/api/jewellery", json=payload, headers=auth).json()
    jid, token = created["jewellery_id"], created["verification_token"]
    assert created["has_photo"] is False
    assert client.get(f"/api/verify/{token}").json()["photo_version"] is None

    res = client.post(f"/api/jewellery/{jid}/photo", files={"file": ("p.png", PNG_1PX, "image/png")}, headers=auth)
    assert res.status_code == 200 and res.json()["has_photo"] is True
    assert client.get(f"/api/jewellery/{jid}/photo", headers=auth).content == PNG_1PX

    # Buyers fetch it through the verification code, without signing in.
    version = client.get(f"/api/verify/{token}").json()["photo_version"]
    assert version
    res = client.get(f"/api/verify/{token}/photo")
    assert res.status_code == 200 and res.content == PNG_1PX

    res = client.post(f"/api/jewellery/{jid}/photo", files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")}, headers=auth)
    assert res.status_code == 422  # photos are images only

    client.delete(f"/api/jewellery/{jid}", headers=auth)
    assert client.get(f"/api/verify/{token}/photo").status_code == 410

    assert client.delete(f"/api/jewellery/{jid}/photo", headers=auth).json()["has_photo"] is False


def test_design_fields_and_making_range_validation(client, auth, payload):
    body = {**payload, "colour": "Rose gold", "design_details": "Floral filigree",
            "making_percent_min": "10", "making_percent_max": "14"}
    created = client.post("/api/jewellery", json=body, headers=auth).json()
    assert created["colour"] == "Rose gold" and Decimal(created["making_percent_max"]) == 14
    public = client.get(f"/api/verify/{created['verification_token']}").json()
    assert public["design_details"] == "Floral filigree" and public["colour"] == "Rose gold"

    for bad in ({"making_percent_min": "10"}, {"making_percent_min": "15", "making_percent_max": "10"},
                {"colour": "Purple gold"}):
        assert client.post("/api/jewellery", json={**payload, **bad}, headers=auth).status_code == 422, bad


def test_store_settings(client, auth, payload):
    assert client.get("/api/settings").status_code == 401
    res = client.get("/api/settings", headers=auth).json()
    assert res["store_name"] == "" and Decimal(res["gst_percent"]) == 3
    assert res["gold_feed_configured"] is False and res["gold_rate"] is None

    res = client.put("/api/settings", json={"store_name": "  Example Jewellers ", "gst_percent": "3"}, headers=auth)
    assert res.status_code == 200 and res.json()["store_name"] == "Example Jewellers"

    token = client.post("/api/jewellery", json=payload, headers=auth).json()["verification_token"]
    body = client.get(f"/api/verify/{token}").json()
    assert body["store_name"] == "Example Jewellers"
    assert body["gold_rate"] is None and body["live_price"] is None  # no feed: registered prices only


def test_live_price_from_market_rate(client, auth, payload, monkeypatch):
    from app.config import get_settings
    from app.services import gold_rate

    calls = []

    def fake_fetch(provider, key):
        calls.append((provider, key))
        return Decimal("10000.00"), "test feed"

    monkeypatch.setattr(get_settings(), "goldapi_key", "test-key")
    monkeypatch.setattr(gold_rate, "fetch_inr_per_gram_24k", fake_fetch)

    body = {**payload, "net_weight": "10", "other_component_value": "1000",
            "making_percent_min": "10", "making_percent_max": "15"}
    token = client.post("/api/jewellery", json=body, headers=auth).json()["verification_token"]

    res = client.get(f"/api/verify/{token}").json()
    rate, live = res["gold_rate"], res["live_price"]
    assert Decimal(rate["per_gram"]["22K"]) == Decimal("9160")
    assert rate["change_percent"] is None
    # 10 g x 9,160 = 91,600; making 10-15% = 9,160-13,740; GST 3% on gold + making + stones.
    assert Decimal(live["gold_value"]) == 91600
    assert (Decimal(live["making_charges_min"]), Decimal(live["making_charges_max"])) == (9160, 13740)
    assert (Decimal(live["tax_min"]), Decimal(live["tax_max"])) == (3053, 3190)
    assert (Decimal(live["total_min"]), Decimal(live["total_max"])) == (104813, 109530)

    # Within the cache window the API isn't called again.
    client.get(f"/api/verify/{token}")
    assert calls == [("goldapi", "test-key")]


def test_gold_rate_falls_back_to_last_known(client, auth, payload, monkeypatch):
    from datetime import datetime, timedelta, timezone

    from app.config import get_settings
    from app.database import get_db
    from app.main import app
    from app.models import GoldRate
    from app.services import gold_rate

    db = next(app.dependency_overrides[get_db]())
    old = datetime.now(timezone.utc) - timedelta(days=1)
    db.add_all([GoldRate(inr_per_gram_24k=Decimal("9800"), source="test", fetched_at=old - timedelta(hours=1)),
                GoldRate(inr_per_gram_24k=Decimal("10000"), source="test", fetched_at=old)])
    db.commit()

    def failing_fetch(provider, key):
        raise OSError("network down")

    monkeypatch.setattr(get_settings(), "goldapi_key", "test-key")
    monkeypatch.setattr(gold_rate, "fetch_inr_per_gram_24k", failing_fetch)

    token = client.post("/api/jewellery", json=payload, headers=auth).json()["verification_token"]
    rate = client.get(f"/api/verify/{token}").json()["gold_rate"]
    assert Decimal(rate["per_gram"]["24K"]) == Decimal("9990")
    assert Decimal(rate["change_percent"]) == Decimal("2.04")


def test_metals_dev_prefers_ibja_rate(monkeypatch):
    from app.services import gold_rate

    seen = []

    def fake_get_json(request):
        seen.append(request.full_url)
        return {"status": "success", "metals": {"gold": 9500.123, "ibja_gold": 10920.5}}

    monkeypatch.setattr(gold_rate, "_get_json", fake_get_json)
    assert gold_rate.fetch_inr_per_gram_24k("metals.dev", "k") == (Decimal("10920.50"), "IBJA via metals.dev")
    assert "currency=INR" in seen[0] and "unit=g" in seen[0]

    monkeypatch.setattr(gold_rate, "_get_json", lambda r: {"status": "success", "metals": {"gold": 9500.123}})
    assert gold_rate.fetch_inr_per_gram_24k("metals.dev", "k") == (Decimal("9500.12"), "metals.dev")

    monkeypatch.setattr(gold_rate, "_get_json", lambda r: {"status": "failure", "error_code": 1101})
    with pytest.raises(ValueError):
        gold_rate.fetch_inr_per_gram_24k("metals.dev", "bad")
