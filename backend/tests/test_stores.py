from decimal import Decimal

import pytest

STORE = {
    "name": "Shree Ganesh Jewellers",
    "address": "12 Sheikh Memon Street, Zaveri Bazaar",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": "18.9517",
    "longitude": "72.8331",
    "phone": "+91 98200 00000",
    "whatsapp": "",
    "hours": "Mon-Sat 11 am - 8 pm",
}


def test_stores_require_admin(client):
    assert client.get("/api/stores").status_code == 401
    assert client.post("/api/stores", json=STORE).status_code == 401


def test_create_and_get_store(client, auth):
    res = client.post("/api/stores", json=STORE, headers=auth)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "shree-ganesh-jewellers"
    assert body["phone"] == "+919820000000" and body["whatsapp"] is None
    assert Decimal(body["latitude"]) == Decimal("18.9517")
    assert (body["status"], body["piece_count"], body["design_count"], body["photos"]) == ("active", 0, 0, [])
    assert "id" not in body
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).json()["name"] == "Shree Ganesh Jewellers"
    assert client.get("/api/stores/nope", headers=auth).status_code == 404


def test_duplicate_names_get_distinct_slugs(client, auth):
    first = client.post("/api/stores", json=STORE, headers=auth).json()
    second = client.post("/api/stores", json=STORE, headers=auth).json()
    assert (first["slug"], second["slug"]) == ("shree-ganesh-jewellers", "shree-ganesh-jewellers-2")

    res = client.post("/api/stores", json={**STORE, "slug": "test-store"}, headers=auth)
    assert res.status_code == 422 and "slug" in res.json()["fields"]


@pytest.mark.parametrize("change, field", [
    ({"latitude": "91"}, "latitude"),
    ({"longitude": "-181"}, "longitude"),
    ({"phone": "12ab"}, "phone"),
    ({"name": " "}, "name"),
    ({"slug": "Not A Slug"}, "slug"),
])
def test_store_validation(client, auth, change, field):
    res = client.post("/api/stores", json={**STORE, **change}, headers=auth)
    assert res.status_code == 422 and field in res.json()["fields"], res.text


def test_coordinates_are_rounded_to_six_places(client, auth):
    body = client.post("/api/stores", json={**STORE, "latitude": "18.95170049", "longitude": 72.83310051},
                       headers=auth).json()
    assert (Decimal(body["latitude"]), Decimal(body["longitude"])) == (Decimal("18.951700"), Decimal("72.833101"))


def test_update_store_keeps_its_slug_unless_changed(client, auth):
    client.post("/api/stores", json=STORE, headers=auth)
    res = client.put("/api/stores/shree-ganesh-jewellers", json={**STORE, "name": "Shree Ganesh & Sons"}, headers=auth)
    assert (res.json()["slug"], res.json()["name"]) == ("shree-ganesh-jewellers", "Shree Ganesh & Sons")

    res = client.put("/api/stores/shree-ganesh-jewellers", json={**STORE, "slug": "ganesh-sons"}, headers=auth)
    assert res.json()["slug"] == "ganesh-sons"
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 404


def test_store_with_pieces_cannot_be_deleted(client, auth, payload):
    client.post("/api/jewellery", json=payload, headers=auth)
    assert client.delete("/api/stores/test-store", headers=auth).status_code == 409

    client.post("/api/stores", json=STORE, headers=auth)
    assert client.delete("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 204
    assert client.get("/api/stores/shree-ganesh-jewellers", headers=auth).status_code == 404


def test_deactivating_a_store_hides_its_pieces(client, auth, publish):
    token = publish()["verification_token"]
    assert client.post("/api/stores/test-store/deactivate", headers=auth).json()["status"] == "inactive"
    assert client.get(f"/api/verify/{token}").status_code == 410
    assert client.post("/api/stores/test-store/activate", headers=auth).json()["status"] == "active"
    assert client.get(f"/api/verify/{token}").status_code == 200


def test_list_stores_with_counts(client, auth, payload):
    client.post("/api/jewellery", json=payload, headers=auth)
    client.post("/api/stores", json=STORE, headers=auth)
    stores = client.get("/api/stores", headers=auth).json()
    assert [(s["slug"], s["piece_count"]) for s in stores] == [("shree-ganesh-jewellers", 0), ("test-store", 1)]
