from datetime import datetime, timezone
from decimal import Decimal

from app.models import GoldRate
from tests.test_designs import DESIGN, jpeg
from tests.test_public import published_design
from tests.test_stores import STORE

CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"


def catalog(client):
    res = client.get("/api/public/catalog")
    assert res.status_code == 200, res.text
    return res


def test_catalog_lists_what_buyers_can_buy(client, auth, payload, publish):
    older = publish(title="Older")
    newer = publish(title="Newer")
    publish(title="Sold", stock_status="sold")
    client.post("/api/jewellery", json=payload, headers=auth)  # a draft
    gone = publish(title="Gone")
    client.delete(f"/api/jewellery/{gone['jewellery_id']}", headers=auth)
    design = published_design(client, auth)
    client.post("/api/designs", json=DESIGN, headers=auth)  # a draft design

    res = catalog(client)
    assert res.headers["cache-control"] == CACHE
    body = res.json()
    assert [p["jewellery_id"] for p in body["pieces"]] == [newer["jewellery_id"], older["jewellery_id"]]
    assert [d["public_id"] for d in body["designs"]] == [design]

    piece = body["pieces"][0]
    assert set(piece) == {"jewellery_id", "title", "type", "purity", "net_weight", "stock_status", "cover", "price",
                          "store", "photos", "created_at"}
    assert piece["store"] == "test-store" and len(piece["photos"]) == 1 and piece["cover"] == piece["photos"][0]
    assert body["designs"][0]["store"] == "test-store" and len(body["designs"][0]["photos"]) == 1

    [store] = body["stores"]
    assert store["slug"] == "test-store" and (store["piece_count"], store["design_count"]) == (2, 1)
    assert store["cover"]["public_id"] == newer["photos"][0]["public_id"]  # no store photo: newest piece's cover
    assert body["gold_rate"] is None
    assert newer["verification_token"] not in res.text


def test_catalog_leaves_out_inactive_stores(client, auth, publish):
    other = client.post("/api/stores", json=STORE, headers=auth).json()["slug"]
    publish(title="Elsewhere", store=other)
    published_design(client, auth, store=other)
    mine = publish(title="Mine")
    client.post(f"/api/stores/{other}/deactivate", headers=auth)

    body = catalog(client).json()
    assert [s["slug"] for s in body["stores"]] == ["test-store"]
    assert [p["jewellery_id"] for p in body["pieces"]] == [mine["jewellery_id"]]
    assert body["designs"] == []


def test_store_cover_prefers_the_store_photo(client, auth, publish):
    publish()
    res = client.post("/api/stores/test-store/photos", files={"file": ("s.jpg", jpeg(), "image/jpeg")}, headers=auth)
    assert res.status_code == 201, res.text
    assert catalog(client).json()["stores"][0]["cover"]["public_id"] == res.json()[0]["public_id"]


def test_catalog_prices_match_the_piece_page(client, publish):
    piece = publish(discount_type="percent", discount_value="10")
    card = catalog(client).json()["pieces"][0]["price"]
    page = client.get(f"/api/verify/{piece['verification_token']}").json()["price"]
    assert (card["final_min"], card["final_max"]) == (page["final_min"], page["final_max"])
    assert card["discount_label"] == "10% off"


def test_gold_rate_endpoint(client, db):
    res = client.get("/api/public/gold-rate")
    assert res.status_code == 200 and res.json() is None and res.headers["cache-control"] == CACHE

    db.add(GoldRate(inr_per_gram_24k=Decimal("10000"), source="test", fetched_at=datetime.now(timezone.utc)))
    db.commit()
    rate = client.get("/api/public/gold-rate").json()
    assert Decimal(rate["per_gram"]["24K"]) == Decimal("9990")  # 24K is 99.9% pure
    assert Decimal(rate["per_gram"]["22K"]) == Decimal("9160")
    assert client.get("/api/public/catalog").json()["gold_rate"]["per_gram"] == rate["per_gram"]
