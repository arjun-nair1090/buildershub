from tests.test_designs import DESIGN, jpeg
from tests.test_stores import STORE


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


# ---------- Design page ----------

def test_design_page(client, auth):
    pid = published_design(client, auth)
    res = client.get(f"/api/public/designs/{pid.lower()}")  # typed in another case
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["public_id"] == pid and body["title"] == "Temple necklace"
    assert body["store"] == {"slug": "test-store", "name": "Test Jewellers", "area": "Test Area", "city": "Mumbai"}
    assert body["purity_options"] == ["22K", "18K"]
    assert (body["making_days_min"], body["making_days_max"]) == (14, 21)
    assert len(body["photos"]) == 1
    for absent in ("jewellery_id", "verification_level", "is_published", "id", "created_at", "updated_at"):
        assert absent not in body


def test_design_page_hides_drafts_and_inactive_stores(client, auth):
    draft = client.post("/api/designs", json=DESIGN, headers=auth).json()["public_id"]
    for pid in (draft, "DSN0000000"):
        res = client.get(f"/api/public/designs/{pid}")
        assert res.status_code == 404 and res.json() == {"detail": "Design not found"}

    pid = published_design(client, auth)
    client.post("/api/stores/test-store/deactivate", headers=auth)
    res = client.get(f"/api/public/designs/{pid}")
    assert res.status_code == 410 and res.json() == {"detail": "Design no longer listed"}


# ---------- Similar pieces ----------
# The payload is a 22K Ring at a registered price of 125000 (no gold rate in tests). Within ±30%: 87500-162500.

def similar_ids(client, piece) -> list[str]:
    res = client.get(f"/api/verify/{piece['verification_token']}")
    assert res.status_code == 200, res.text
    return [c["jewellery_id"] for c in res.json()["similar"]]


def test_similar_pieces_rank_by_category_then_purity_then_price(client, publish):
    me = publish()
    a = publish(title="Ring, 22K, near")                                      # 4 + 2 + 1 = 7
    b = publish(title="Ring, 18K, near", purity="18K")                        # 4 + 1 = 5
    c = publish(title="Ring, 22K, far", gold_value="500000")                  # 4 + 2 = 6
    d = publish(title="Necklace, 22K, near", type="Necklace")                 # 2 + 1 = 3
    e = publish(title="Necklace, 18K, same price", type="Necklace", purity="18K")                     # 1, gap 0
    g = publish(title="Necklace, 18K, a bit dearer", type="Necklace", purity="18K", gold_value="103500")  # 1, gap 5000
    publish(title="Necklace, 18K, far", type="Necklace", purity="18K", gold_value="500000")         # 0: left out

    assert similar_ids(client, me) == [x["jewellery_id"] for x in (a, c, b, d, e, g)]


def test_similar_pieces_leave_out_what_a_buyer_cant_buy_here(client, auth, payload, publish):
    me = publish()
    keep = publish(title="Keep")
    publish(title="Sold", stock_status="sold")
    client.post("/api/jewellery", json=payload, headers=auth)  # a draft
    gone = publish(title="Gone")
    client.delete(f"/api/jewellery/{gone['jewellery_id']}", headers=auth)
    other_store = client.post("/api/stores", json=STORE, headers=auth).json()["slug"]
    publish(title="Elsewhere", store=other_store)

    assert similar_ids(client, me) == [keep["jewellery_id"]]
    assert similar_ids(client, keep) == [me["jewellery_id"]]  # never the piece itself


def test_similar_pieces_empty_and_capped_at_eight(client, publish):
    me = publish()
    assert similar_ids(client, me) == []

    for i in range(9):
        publish(title=f"Ring {i}")
    ids = similar_ids(client, me)
    assert len(ids) == 8 and me["jewellery_id"] not in ids
    assert client.get(f"/api/verify/{ids[0]}").status_code == 200  # cards link by Jewellery ID
