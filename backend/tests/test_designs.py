from io import BytesIO

import pytest
from PIL import Image

from tests.test_stores import STORE

DESIGN = {
    "store": "test-store",
    "title": "Temple necklace",
    "description": "Lakshmi motif with kemp stones",
    "category": "Necklace",
    "purity_options": ["22K", "18K"],
    "weight_min": "30",
    "weight_max": "45",
    "price_min": "350000",
    "price_max": "520000",
    "making_days_min": 14,
    "making_days_max": 21,
}


def jpeg() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (400, 300), (200, 160, 60)).save(buf, "JPEG")
    return buf.getvalue()


def create(client, auth, **changes):
    return client.post("/api/designs", json={**DESIGN, **changes}, headers=auth)


def test_designs_require_admin(client):
    assert client.get("/api/designs").status_code == 401


def test_create_design(client, auth):
    res = create(client, auth)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["public_id"].startswith("DSN") and len(body["public_id"]) == 10
    assert body["purity_options"] == ["22K", "18K"] and body["store"]["slug"] == "test-store"
    assert body["is_published"] is False and body["photos"] == []
    for absent in ("jewellery_id", "verification_level", "verification_token", "discount_type", "id"):
        assert absent not in body  # a design is never presented as a verified piece
    assert client.get(f"/api/designs/{body['public_id']}", headers=auth).json()["title"] == "Temple necklace"


def test_purities_are_ordered_and_deduplicated(client, auth):
    assert create(client, auth, purity_options=["18K", "22K", "18K"]).json()["purity_options"] == ["22K", "18K"]


@pytest.mark.parametrize("change, field", [
    ({"weight_max": "20"}, "weight_max"),
    ({"price_max": "100"}, "price_max"),
    ({"making_days_max": 7}, "making_days_max"),
    ({"making_days_min": 0}, "making_days_min"),
    ({"purity_options": []}, "purity_options"),
    ({"purity_options": ["30K"]}, "purity_options"),
    ({"store": "nowhere"}, "store"),
    ({"price_min": "0"}, "price_min"),
])
def test_design_validation(client, auth, change, field):
    res = create(client, auth, **change)
    assert res.status_code == 422 and field in res.json()["fields"], res.text


def test_publishing_needs_a_photo(client, auth):
    assert "is_published" in create(client, auth, is_published=True).json()["fields"]

    pid = create(client, auth).json()["public_id"]
    res = client.post(f"/api/designs/{pid}/photos", files={"file": ("d.jpg", jpeg(), "image/jpeg")}, headers=auth)
    assert res.status_code == 201
    res = client.put(f"/api/designs/{pid}", json={**DESIGN, "is_published": True}, headers=auth)
    assert res.status_code == 200 and res.json()["is_published"] is True

    photo = res.json()["photos"][0]["public_id"]
    assert client.get(f"/api/photos/{photo}/thumb").status_code == 200  # published design: public
    assert client.delete(f"/api/photos/{photo}", headers=auth).status_code == 422  # its only photo


def test_list_filters_and_delete(client, auth):
    first = create(client, auth).json()["public_id"]
    create(client, auth, title="Bridal choker")
    assert len(client.get("/api/designs", params={"store": "test-store"}, headers=auth).json()) == 2
    assert client.get("/api/designs", params={"store": "elsewhere"}, headers=auth).json() == []
    assert client.get("/api/designs", params={"published": "true"}, headers=auth).json() == []

    assert client.delete(f"/api/designs/{first}", headers=auth).status_code == 204
    assert client.get(f"/api/designs/{first}", headers=auth).status_code == 404


def test_store_with_designs_cannot_be_deleted(client, auth):
    slug = client.post("/api/stores", json=STORE, headers=auth).json()["slug"]
    create(client, auth, store=slug)
    assert client.delete(f"/api/stores/{slug}", headers=auth).status_code == 409
    assert client.get("/api/jewellery/stats", headers=auth).json()["designs"] == 1
