from tests.test_designs import DESIGN, jpeg


def published_design(client, auth, **changes) -> str:
    """Create a design with one photo and publish it. Returns its public id."""
    body = {**DESIGN, **changes}
    pid = client.post("/api/designs", json=body, headers=auth).json()["public_id"]
    res = client.post(f"/api/designs/{pid}/photos", files={"file": ("d.jpg", jpeg(), "image/jpeg")}, headers=auth)
    assert res.status_code == 201, res.text
    res = client.put(f"/api/designs/{pid}", json={**body, "is_published": True}, headers=auth)
    assert res.status_code == 200, res.text
    return pid


# ---------- Store page ----------

def test_store_page_lists_visible_pieces_sold_last(client, auth, payload, publish):
    first = publish(title="First")
    sold = publish(title="Sold one", stock_status="sold")
    reserved = publish(title="Reserved one", stock_status="reserved")
    newest = publish(title="Newest")
    client.post("/api/jewellery", json=payload, headers=auth)  # a draft
    gone = publish(title="Gone")
    assert client.delete(f"/api/jewellery/{gone['jewellery_id']}", headers=auth).status_code == 200

    res = client.get("/api/public/stores/test-store")
    assert res.status_code == 200, res.text
    body = res.json()
    assert [p["jewellery_id"] for p in body["pieces"]] == [
        newest["jewellery_id"], reserved["jewellery_id"], first["jewellery_id"], sold["jewellery_id"],
    ]
    card = body["pieces"][0]
    assert set(card) == {"jewellery_id", "title", "type", "purity", "net_weight", "stock_status", "cover", "price"}
    assert card["cover"]["public_id"] == newest["photos"][0]["public_id"]
    assert body["name"] == "Test Jewellers" and body["hours"] == "Daily 10 am - 8 pm" and body["phone"] is None
    for private in ("id", "status", "piece_count", "design_count", "created_at", "updated_at"):
        assert private not in body


def test_store_page_lists_published_designs_newest_first(client, auth):
    client.post("/api/designs", json=DESIGN, headers=auth)  # a draft
    older = published_design(client, auth, title="Older")
    newer = published_design(client, auth, title="Newer")

    designs = client.get("/api/public/stores/test-store").json()["designs"]
    assert [d["public_id"] for d in designs] == [newer, older]
    assert set(designs[0]) == {"public_id", "title", "category", "purity_options", "weight_min", "weight_max",
                               "price_min", "price_max", "cover"}
    assert designs[0]["cover"] is not None and designs[0]["purity_options"] == ["22K", "18K"]


def test_store_page_unknown_and_inactive(client, auth):
    res = client.get("/api/public/stores/nowhere")
    assert res.status_code == 404 and res.json() == {"detail": "Store not found"}
    assert client.get("/api/public/stores/TEST-STORE").status_code == 200  # typed in another case

    client.post("/api/stores/test-store/deactivate", headers=auth)
    res = client.get("/api/public/stores/test-store")
    assert res.status_code == 410 and res.json() == {"detail": "Store no longer listed"}


def test_card_prices_match_the_piece_page(client, publish):
    deal = publish(title="Deal", discount_type="percent", discount_value="10")
    sold = publish(title="Sold deal", stock_status="sold", discount_type="percent", discount_value="10")

    cards = {c["jewellery_id"]: c["price"] for c in client.get("/api/public/stores/test-store").json()["pieces"]}
    for piece in (deal, sold):
        page = client.get(f"/api/verify/{piece['verification_token']}").json()["price"]
        card = cards[piece["jewellery_id"]]
        for key in ("final_min", "final_max", "original_min", "original_max"):
            assert card[key] == page[key], key
        assert card["discount_label"] == (page["discount"]["label"] if page["discount"] else None)
    assert cards[deal["jewellery_id"]]["discount_label"] == "10% off"
    assert cards[sold["jewellery_id"]]["discount_label"] is None  # a sold piece shows no discount
