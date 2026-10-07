from decimal import Decimal

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


def test_logout(client, auth):
    assert client.post("/api/auth/logout", headers=auth).status_code == 204


def test_admin_routes_require_auth(client):
    assert client.get("/api/jewellery").status_code == 401
    assert client.post("/api/jewellery", json={}).status_code == 401
    assert client.get("/api/jewellery/stats").status_code == 401
    bad = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/api/jewellery", headers=bad).status_code == 401


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


def test_certificate_upload_rejects_bad_files(client, auth, payload):
    jid = client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]
    url = f"/api/jewellery/{jid}/certificate"

    res = client.post(url, files={"file": ("evil.exe", b"MZ...", "application/octet-stream")}, headers=auth)
    assert res.status_code == 422
    # Right extension and MIME type, wrong contents.
    res = client.post(url, files={"file": ("fake.pdf", b"MZ not a pdf", "application/pdf")}, headers=auth)
    assert res.status_code == 422
