from io import BytesIO

import pytest
from PIL import Image

IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable"


def jpeg(size=(800, 600)) -> bytes:
    img = Image.linear_gradient("L").resize(size).convert("RGB")
    buf = BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def upload(client, auth, path: str, alt: str = ""):
    return client.post(path, files={"file": ("p.jpg", jpeg(), "image/jpeg")}, data={"alt_text": alt}, headers=auth)


@pytest.fixture()
def piece(client, auth, payload) -> str:
    return client.post("/api/jewellery", json=payload, headers=auth).json()["jewellery_id"]


def test_upload_requires_admin(client, piece):
    res = client.post(f"/api/jewellery/{piece}/photos", files={"file": ("p.jpg", jpeg(), "image/jpeg")})
    assert res.status_code == 401


def test_upload_and_list(client, auth, piece):
    res = upload(client, auth, f"/api/jewellery/{piece}/photos")
    assert res.status_code == 201, res.text
    [photo] = res.json()
    assert (photo["position"], photo["alt_text"], photo["alt"]) == (0, "", "Diamond ring")
    assert (photo["width"], photo["height"]) == (800, 600)

    res = upload(client, auth, f"/api/jewellery/{piece}/photos", alt="Side view")
    assert [p["alt"] for p in res.json()] == ["Diamond ring", "Side view"]
    record = client.get(f"/api/jewellery/{piece}", headers=auth).json()
    assert [p["public_id"] for p in record["photos"]] == [p["public_id"] for p in res.json()]


def test_at_most_six_photos(client, auth, piece):
    for _ in range(6):
        assert upload(client, auth, f"/api/jewellery/{piece}/photos").status_code == 201
    res = upload(client, auth, f"/api/jewellery/{piece}/photos")
    assert res.status_code == 422 and "6" in res.json()["detail"]


def test_rejects_bad_uploads(client, auth, piece, monkeypatch):
    res = client.post(f"/api/jewellery/{piece}/photos", files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")},
                      headers=auth)
    assert res.status_code == 422

    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "max_upload_mb", 0)
    assert upload(client, auth, f"/api/jewellery/{piece}/photos").status_code == 422


def test_unknown_owner(client, auth):
    assert upload(client, auth, "/api/jewellery/JWL-00-NOPE00/photos").status_code == 404
    assert upload(client, auth, "/api/widgets/x/photos").status_code == 422


def test_reorder_alt_text_and_delete(client, auth, piece):
    for _ in range(3):
        ids = [p["public_id"] for p in upload(client, auth, f"/api/jewellery/{piece}/photos").json()]

    res = client.put(f"/api/jewellery/{piece}/photos/order", json={"photo_ids": ids[::-1]}, headers=auth)
    assert [p["public_id"] for p in res.json()] == ids[::-1]
    assert client.put(f"/api/jewellery/{piece}/photos/order", json={"photo_ids": ids[:2]},
                      headers=auth).status_code == 422

    res = client.put(f"/api/photos/{ids[0]}", json={"alt_text": "  Clasp detail "}, headers=auth)
    assert {p["public_id"]: p["alt_text"] for p in res.json()}[ids[0]] == "Clasp detail"

    res = client.delete(f"/api/photos/{ids[1]}", headers=auth)
    assert [p["public_id"] for p in res.json()] == [ids[2], ids[0]]
    assert [p["position"] for p in res.json()] == [0, 1]


def test_published_piece_keeps_its_last_photo(client, auth, payload, piece):
    upload(client, auth, f"/api/jewellery/{piece}/photos")
    client.put(f"/api/jewellery/{piece}", json={**payload, "is_published": True}, headers=auth)
    [photo] = client.get(f"/api/jewellery/{piece}", headers=auth).json()["photos"]
    assert client.delete(f"/api/photos/{photo['public_id']}", headers=auth).status_code == 422


def test_photo_bytes_are_public_only_while_visible(client, auth, payload, piece):
    [photo] = upload(client, auth, f"/api/jewellery/{piece}/photos").json()
    full_url = f"/api/photos/{photo['public_id']}/full"
    assert client.get(full_url).status_code == 404  # a draft's photos are hidden from the public
    res = client.get(full_url, headers=auth)
    assert res.status_code == 200 and res.headers["cache-control"] == "private, no-store"

    client.put(f"/api/jewellery/{piece}", json={**payload, "is_published": True}, headers=auth)
    full, thumb = client.get(full_url), client.get(f"/api/photos/{photo['public_id']}/thumb")
    assert full.status_code == thumb.status_code == 200
    assert full.headers["content-type"] == "image/jpeg" and full.headers["cache-control"] == IMMUTABLE
    assert len(thumb.content) < len(full.content)
    assert client.get(f"/api/photos/{photo['public_id']}/huge").status_code == 422
    assert client.get("/api/photos/" + "0" * 32 + "/full").status_code == 404


def test_store_photos(client, auth):
    res = upload(client, auth, "/api/stores/test-store/photos")
    assert res.status_code == 201 and res.json()[0]["alt"] == "Test Jewellers"
    assert client.get(f"/api/photos/{res.json()[0]['public_id']}/thumb").status_code == 200  # active store
    assert client.get("/api/stores/test-store", headers=auth).json()["photos"][0]["public_id"] == res.json()[0]["public_id"]
