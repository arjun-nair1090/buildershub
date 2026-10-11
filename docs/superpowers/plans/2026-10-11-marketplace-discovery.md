# Marketplace Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let buyers find jewellery: a browsing home page with the gold rate, a `/search` page with filters and
Near me, and a `/feed` of photos with saves.

**Architecture:** One cacheable endpoint (`/api/public/catalog`) returns everything buyers can browse; the browser
searches, filters and sorts it with pure functions in `src/lib/discovery/`, so the buyer's location never leaves
the device. A small `/api/public/gold-rate` endpoint feeds the home page ticker. Saves live in `localStorage`.

**Tech Stack:** FastAPI, SQLAlchemy 2, Pydantic v2, pytest on SQLite; React 19, TypeScript, Vite 8, Tailwind v4,
react-router, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-11-marketplace-discovery-design.md`

## Global Constraints

- No database migration, no admin changes, no new dependencies (backend or frontend), no frontend test runner.
- The buyer's coordinates are never sent to the server, put in the URL, or written to storage. They live in
  React state for the visit only.
- Search, filters and sort run in the browser over `/api/public/catalog`.
- Catalogue pieces: published, active, not sold, store active. Designs: published, store active. Stores: active.
- Card prices come from `piece_price` with one `pricing_context`, so they match the piece page.
- Cache header on both new endpoints: `public, max-age=0, s-maxage=60, stale-while-revalidate=300`.
- URL filter params: `q, tab, cat, purity, wmin, wmax, pmin, pmax, km, city, sort`; unknown or malformed values
  are ignored. Distances offered: 2, 5, 10, 25 km.
- Storage keys: `jewlerify.saved` (ids like `piece:JWL-26-ABCDEF`, `design:DSNABCDEFG`), `jewlerify.city`. Every
  storage read and write is in try/catch; saves fall back to memory.
- Copy: hero headline "Find verified gold jewellery near you."; location line "Your location stays on this device
  and is only used to sort by distance."; refusal "Location isn't available. Pick a city instead."; no rate "Gold
  rate unavailable right now"; no results "Nothing matches these filters".
- Hero photo: the store's own `rani-haar.jpg`, no stock photos. No diamond graphics.
- Commit messages: plain sentences ("Add ..."), no AI attribution or co-author trailers.
- Backend tests: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`. Frontend gate:
  `npm --prefix frontend run build` plus the scratch logic check (Task 2) and the browser checks (Task 7).

## Review Focus

1. Near me when the buyer never answers the browser prompt: after 10 s the page must give up and offer the city
   picker, not spin forever (Task 2 `NearMeProvider` has its own timer; Task 7 checks a denied and a granted run).
2. A shared or reloaded `/search` URL with `sort=nearest` or `km=5` but no location: results must still show
   (nearest falls back to newest, the distance filter is ignored) (Task 2 logic check asserts both).
3. Private browsing where `localStorage` throws: saving must still work for the session and nothing may crash
   (Task 2 `useSaved` memory fallback; Task 7 checks a save survives a reload in a normal profile).
4. Phone width 390 px: the hero text stays readable over the photo, the filter sheet scrolls and its "Show n
   results" button stays reachable, nothing scrolls sideways (Task 7 screenshots and scrollWidth checks).
5. A saved piece that was since sold or unpublished: the Saved view shows "No longer available" with Remove,
   instead of a broken card (Task 6 code; Task 7 check with a fake saved id).

---

### Task 1: Catalogue and gold rate endpoints

**Files:**
- Modify: `backend/app/schemas.py` (add `CatalogStore`, `CatalogPiece`, `CatalogDesign`, `Catalog` after `PublicDesign`)
- Modify: `backend/app/routers/public.py`
- Create: `backend/tests/test_catalog.py`
- Modify: `README.md` (API summary table)

**Interfaces:**
- Consumes: `piece_card(piece, price)`, `design_card(design)`, `price_now(piece, ctx)` from `app/services/cards.py`;
  `pricing_context(db)`, `gold_rate_out(rate)` from `app/services/pricing.py`; `current_rate(db)` from
  `app/services/gold_rate.py`; test helper `published_design(client, auth, **changes)` from `tests/test_public.py`.
- Produces: `GET /api/public/catalog` → `Catalog`; `GET /api/public/gold-rate` → `GoldRateOut | None`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_catalog.py`:

```python
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
    assert Decimal(rate["per_gram"]["24K"]) == Decimal("10000") and Decimal(rate["per_gram"]["22K"]) == Decimal("9160")
    assert client.get("/api/public/catalog").json()["gold_rate"]["per_gram"] == rate["per_gram"]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_catalog.py -q -p no:warnings`
Expected: 5 failed (404 from the missing routes).

- [ ] **Step 3: Add the schemas**

In `backend/app/schemas.py`, after `class PublicDesign`, add:

```python
class CatalogStore(StoreRef):
    latitude: Decimal
    longitude: Decimal
    cover: PhotoOut | None  # the store's first photo, else its newest piece's cover
    piece_count: int
    design_count: int


class CatalogPiece(PieceCard):
    store: str  # slug
    photos: list[PhotoOut]
    created_at: datetime


class CatalogDesign(DesignCard):
    store: str  # slug
    photos: list[PhotoOut]
    created_at: datetime


class Catalog(BaseModel):
    """Everything buyers can browse. The browser searches, filters and sorts it, so a buyer's location never
    has to reach the server."""

    gold_rate: GoldRateOut | None
    stores: list[CatalogStore]
    pieces: list[CatalogPiece]
    designs: list[CatalogDesign]
```

- [ ] **Step 4: Add the endpoints**

In `backend/app/routers/public.py`:
- change `from fastapi import APIRouter, Depends, HTTPException, Path, status` to
  `from fastapi import APIRouter, Depends, HTTPException, Path, Response, status`;
- add `from collections import Counter` at the top;
- change the schemas import to
  `from app.schemas import Catalog, CatalogDesign, CatalogPiece, CatalogStore, GoldRateOut, PublicDesign, PublicStore, StoreRef`;
- change the pricing import to `from app.services.pricing import gold_rate_out, pricing_context`;
- add `from app.services.gold_rate import current_rate`;
- update the module docstring to `"""Pages buyers open without logging in: a store, a design, the catalogue they browse and the gold rate. Read-only."""`;
- below `SOLD_LAST`, add `BROWSE_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"`;
- append:

```python
@router.get("/catalog", response_model=Catalog)
def catalog(response: Response, db: Session = Depends(get_db)) -> Catalog:
    response.headers["Cache-Control"] = BROWSE_CACHE
    stores = db.scalars(select(Store).where(Store.status == "active").order_by(Store.name)).all()
    store_ids = [s.id for s in stores]
    pieces = db.scalars(
        select(Jewellery)
        .where(
            Jewellery.store_id.in_(store_ids),
            Jewellery.is_published.is_(True),
            Jewellery.status == "active",
            Jewellery.stock_status != "sold",
        )
        .order_by(Jewellery.created_at.desc(), Jewellery.id.desc())
    ).all()
    designs = db.scalars(
        select(Design)
        .where(Design.store_id.in_(store_ids), Design.is_published.is_(True))
        .order_by(Design.created_at.desc(), Design.id.desc())
    ).all()
    ctx = pricing_context(db)

    piece_count = Counter(p.store_id for p in pieces)
    design_count = Counter(d.store_id for d in designs)
    newest_cover = {}
    for p in pieces:  # newest first, so the first one seen per store wins
        if p.photos and p.store_id not in newest_cover:
            newest_cover[p.store_id] = photo_out(p.photos[0], p.title)

    return Catalog(
        gold_rate=gold_rate_out(ctx.rate) if ctx.rate else None,
        stores=[
            CatalogStore(
                slug=s.slug, name=s.name, area=s.area, city=s.city, latitude=s.latitude, longitude=s.longitude,
                cover=photo_out(s.photos[0], s.name) if s.photos else newest_cover.get(s.id),
                piece_count=piece_count[s.id], design_count=design_count[s.id],
            )
            for s in stores
        ],
        pieces=[
            CatalogPiece(
                **piece_card(p, price_now(p, ctx)).model_dump(),
                store=p.store.slug,
                photos=[photo_out(ph, p.title) for ph in p.photos],
                created_at=p.created_at,
            )
            for p in pieces
        ],
        designs=[
            CatalogDesign(
                **design_card(d).model_dump(),
                store=d.store.slug,
                photos=[photo_out(ph, d.title) for ph in d.photos],
                created_at=d.created_at,
            )
            for d in designs
        ],
    )


@router.get("/gold-rate", response_model=GoldRateOut | None)
def gold_rate(response: Response, db: Session = Depends(get_db)) -> GoldRateOut | None:
    """The saved rate the piece page shows, for the home page ticker. None if no rate was ever fetched."""
    response.headers["Cache-Control"] = BROWSE_CACHE
    rate = current_rate(db)
    return gold_rate_out(rate) if rate else None
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_catalog.py -q -p no:warnings`
Expected: `5 passed`

- [ ] **Step 6: Document the endpoints**

In `README.md` section 7's table, after the `/api/public/designs/{public_id}` row, add:

```markdown
| GET | `/api/public/catalog` | public | Everything buyers can browse (stores, pieces in stock or reserved, designs, gold rate); the browser filters it. Cached 60 s at the CDN |
| GET | `/api/public/gold-rate` | public | The saved gold rate per karat with its time, or `null` before the first fetch |
```

- [ ] **Step 7: Run the whole suite and commit**

Run: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`
Expected: all pass (161 before, 166 now).

```bash
git add backend/app/schemas.py backend/app/routers/public.py backend/tests/test_catalog.py README.md
git commit -m "Add the public catalogue and gold rate endpoints"
```

---

### Task 2: Discovery logic, data hooks and Near me state

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/public.ts`
- Create: `frontend/src/lib/discovery/distance.ts`
- Create: `frontend/src/lib/discovery/search.ts`
- Create: `frontend/src/lib/discovery/params.ts`
- Create: `frontend/src/lib/discovery/feed.ts`
- Create: `frontend/src/lib/discovery/city.ts`
- Create: `frontend/src/hooks/useCatalog.ts`
- Create: `frontend/src/hooks/useSaved.ts`
- Create: `frontend/src/hooks/useNearMe.tsx`

**Interfaces:**
- Consumes: Task 1 response shapes; `usePublicRecord(key, load)` from `@/hooks/usePublicRecord`; `JEWELLERY_TYPES`,
  `PURITIES` from `@/types`.
- Produces:
  - types `CatalogStore`, `CatalogPiece`, `CatalogDesign`, `Catalog`
  - `publicService.catalog(signal?)`, `publicService.goldRate(signal?)`
  - `Point`, `distanceKm(a, b)`, `formatKm(km)`
  - `Tab`, `Sort`, `Filters`, `DEFAULT_FILTERS`, `DISTANCES`, `TABS`, `SORTS`, `Located<T>`, `Results`,
    `searchCatalog(catalog, filters, here) -> Results`, `activeFilterCount(filters)`
  - `filtersFromParams(params) -> Filters`, `filtersToParams(filters) -> URLSearchParams`
  - `FeedTile`, `feedTiles(catalog) -> FeedTile[]`
  - `lastCity() -> string | null`, `rememberCity(city)`
  - `useCatalog()` → `{ state: LoadState<Catalog>, retry }`
  - `SavedKind`, `savedKey(kind, id)`, `useSaved()` → `{ saved: string[], isSaved(kind, id), toggle(kind, id), remove(key) }`
  - `NearMeProvider`, `useNearMe()` → `{ here: Point | null, status, request(): Promise<Point | null> }`

Ruling carried from the spec: the spec's `useLocation()` is named `useNearMe()`, because `useLocation` is
react-router's hook and both are used in the same files.

- [ ] **Step 1: Types and service**

Append to `frontend/src/types/index.ts`:

```ts
export interface CatalogStore extends StoreRef {
  latitude: DecimalString;
  longitude: DecimalString;
  cover: Photo | null;
  piece_count: number;
  design_count: number;
}

export interface CatalogPiece extends PieceCard {
  /** Store slug. */
  store: string;
  photos: Photo[];
  created_at: string;
}

export interface CatalogDesign extends DesignCard {
  /** Store slug. */
  store: string;
  photos: Photo[];
  created_at: string;
}

/** Everything buyers can browse; the browser searches and filters it. */
export interface Catalog {
  gold_rate: GoldRate | null;
  stores: CatalogStore[];
  pieces: CatalogPiece[];
  designs: CatalogDesign[];
}
```

In `frontend/src/services/public.ts`, change the type import to
`import type { Catalog, GoldRate, PublicDesign, PublicStore } from "@/types";` and add to `publicService`:

```ts
  catalog: (signal?: AbortSignal) => request<Catalog>("/api/public/catalog", { auth: false, signal }),
  /** null before the first rate has ever been fetched. */
  goldRate: (signal?: AbortSignal) => request<GoldRate | null>("/api/public/gold-rate", { auth: false, signal }),
```

- [ ] **Step 2: Distance**

Create `frontend/src/lib/discovery/distance.ts`:

```ts
export interface Point {
  lat: number;
  lng: number;
}

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance (haversine), in km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "0.8 km", "2.3 km", "14 km". */
export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
```

- [ ] **Step 3: Search**

Create `frontend/src/lib/discovery/search.ts`:

```ts
import type { Catalog, CatalogDesign, CatalogPiece, CatalogStore, JewelleryType, Purity } from "@/types";
import { distanceKm, type Point } from "./distance";

export const TABS = ["pieces", "designs", "stores"] as const;
export type Tab = (typeof TABS)[number];
export const SORTS = ["newest", "price_asc", "price_desc", "nearest"] as const;
export type Sort = (typeof SORTS)[number];
export const DISTANCES = [2, 5, 10, 25] as const;

export interface Filters {
  q: string;
  tab: Tab;
  categories: JewelleryType[];
  purities: Purity[];
  weightMin: number | null;
  weightMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  km: number | null;
  city: string | null;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  tab: "pieces",
  categories: [],
  purities: [],
  weightMin: null,
  weightMax: null,
  priceMin: null,
  priceMax: null,
  km: null,
  city: null,
  sort: "newest",
};

export type Located<T> = T & { distanceKm: number | null };

export interface Results {
  pieces: Located<CatalogPiece>[];
  designs: Located<CatalogDesign>[];
  stores: Located<CatalogStore>[];
}

const mid = (min: string, max: string) => (Number(min) + Number(max)) / 2;
const within = (value: number, min: number | null, max: number | null) =>
  (min === null || value >= min) && (max === null || value <= max);
const overlaps = (lo: number, hi: number, min: number | null, max: number | null) =>
  (max === null || lo <= max) && (min === null || hi >= min);

/** How many filters in the panel are set, for the "Filters (n)" button. */
export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length +
    f.purities.length +
    Number(f.weightMin !== null || f.weightMax !== null) +
    Number(f.priceMin !== null || f.priceMax !== null) +
    Number(f.km !== null)
  );
}

/**
 * Filters and sorts the catalogue for one search. `here` is the buyer's location when they allowed it; without
 * it, the distance filter is ignored and "nearest" falls back to "newest", so a shared link still shows results.
 */
export function searchCatalog(catalog: Catalog, f: Filters, here: Point | null): Results {
  const stores = new Map(catalog.stores.map((s) => [s.slug, s]));
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const textMatches = (...fields: string[]) => {
    const haystack = fields.join(" ").toLowerCase();
    return terms.every((t) => haystack.includes(t));
  };
  const distanceTo = (s: CatalogStore) =>
    here ? distanceKm(here, { lat: Number(s.latitude), lng: Number(s.longitude) }) : null;
  const placeMatches = (s: CatalogStore, d: number | null) =>
    (f.city === null || s.city === f.city) && (f.km === null || d === null || d <= f.km);

  const pieces: Located<CatalogPiece>[] = [];
  for (const p of catalog.pieces) {
    const s = stores.get(p.store);
    if (!s) continue;
    const d = distanceTo(s);
    if (
      placeMatches(s, d) &&
      textMatches(p.title, p.type, s.name, s.area, s.city) &&
      (f.categories.length === 0 || f.categories.includes(p.type)) &&
      (f.purities.length === 0 || f.purities.includes(p.purity)) &&
      within(Number(p.net_weight), f.weightMin, f.weightMax) &&
      within(mid(p.price.final_min, p.price.final_max), f.priceMin, f.priceMax)
    )
      pieces.push({ ...p, distanceKm: d });
  }

  const designs: Located<CatalogDesign>[] = [];
  for (const x of catalog.designs) {
    const s = stores.get(x.store);
    if (!s) continue;
    const d = distanceTo(s);
    if (
      placeMatches(s, d) &&
      textMatches(x.title, x.category, s.name, s.area, s.city) &&
      (f.categories.length === 0 || f.categories.includes(x.category)) &&
      (f.purities.length === 0 || x.purity_options.some((k) => f.purities.includes(k))) &&
      overlaps(Number(x.weight_min), Number(x.weight_max), f.weightMin, f.weightMax) &&
      overlaps(Number(x.price_min), Number(x.price_max), f.priceMin, f.priceMax)
    )
      designs.push({ ...x, distanceKm: d });
  }

  const storeResults: Located<CatalogStore>[] = [];
  for (const s of catalog.stores) {
    const d = distanceTo(s);
    if (placeMatches(s, d) && textMatches(s.name, s.area, s.city)) storeResults.push({ ...s, distanceKm: d });
  }

  const sort = f.sort === "nearest" && !here ? "newest" : f.sort;
  const byDistance = <T extends { distanceKm: number | null }>(a: T, b: T) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
  const pieceMid = (p: CatalogPiece) => mid(p.price.final_min, p.price.final_max);
  const designMid = (x: CatalogDesign) => mid(x.price_min, x.price_max);

  // The catalogue arrives newest first, and Array.prototype.sort is stable, so "newest" needs no sort.
  if (sort === "price_asc") {
    pieces.sort((a, b) => pieceMid(a) - pieceMid(b));
    designs.sort((a, b) => designMid(a) - designMid(b));
  } else if (sort === "price_desc") {
    pieces.sort((a, b) => pieceMid(b) - pieceMid(a));
    designs.sort((a, b) => designMid(b) - designMid(a));
  } else if (sort === "nearest") {
    pieces.sort(byDistance);
    designs.sort(byDistance);
  }
  if (sort === "nearest") storeResults.sort(byDistance);
  else storeResults.sort((a, b) => a.name.localeCompare(b.name));

  return { pieces, designs, stores: storeResults };
}
```

- [ ] **Step 4: URL params**

Create `frontend/src/lib/discovery/params.ts`:

```ts
import { JEWELLERY_TYPES, PURITIES } from "@/types";
import { DEFAULT_FILTERS, DISTANCES, SORTS, TABS, type Filters } from "./search";

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** Reads filters from the URL. Anything unknown or malformed is dropped rather than breaking the page. */
export function filtersFromParams(p: URLSearchParams): Filters {
  const list = <T extends string>(key: string, allowed: readonly T[]) =>
    (p.get(key) ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
  const num = (key: string) => {
    const raw = p.get(key);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const km = num("km");
  return {
    q: p.get("q") ?? "",
    tab: oneOf(p.get("tab"), TABS) ?? DEFAULT_FILTERS.tab,
    categories: list("cat", JEWELLERY_TYPES),
    purities: list("purity", PURITIES),
    weightMin: num("wmin"),
    weightMax: num("wmax"),
    priceMin: num("pmin"),
    priceMax: num("pmax"),
    km: km !== null && (DISTANCES as readonly number[]).includes(km) ? km : null,
    city: p.get("city")?.trim() || null,
    sort: oneOf(p.get("sort"), SORTS) ?? DEFAULT_FILTERS.sort,
  };
}

/** Only what differs from the defaults goes in the URL. The buyer's location never does. */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  // Kept as typed (not trimmed): the search box writes here on every keystroke, so a trailing space must survive.
  if (f.q.trim()) p.set("q", f.q);
  if (f.tab !== DEFAULT_FILTERS.tab) p.set("tab", f.tab);
  if (f.categories.length) p.set("cat", f.categories.join(","));
  if (f.purities.length) p.set("purity", f.purities.join(","));
  const nums: [string, number | null][] = [
    ["wmin", f.weightMin],
    ["wmax", f.weightMax],
    ["pmin", f.priceMin],
    ["pmax", f.priceMax],
    ["km", f.km],
  ];
  for (const [key, value] of nums) if (value !== null) p.set(key, String(value));
  if (f.city) p.set("city", f.city);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  return p;
}
```

- [ ] **Step 5: Feed tiles and remembered city**

Create `frontend/src/lib/discovery/feed.ts`:

```ts
import type { Catalog, Photo } from "@/types";
import type { SavedKind } from "@/hooks/useSaved";
import { formatINRRange } from "@/utils/format";

export interface FeedTile {
  /** Unique per photo. */
  key: string;
  kind: SavedKind;
  /** Jewellery ID or design public id. */
  id: string;
  title: string;
  href: string;
  price: string;
  photo: Photo;
}

/** One tile per photo of every piece and design, newest item first, each item's photos in their own order. */
export function feedTiles(catalog: Catalog): FeedTile[] {
  const items = [
    ...catalog.pieces.map((p) => ({
      kind: "piece" as const,
      id: p.jewellery_id,
      title: p.title,
      href: `/verify/${p.jewellery_id}`,
      price: formatINRRange(p.price.final_min, p.price.final_max),
      photos: p.photos,
      created_at: p.created_at,
    })),
    ...catalog.designs.map((d) => ({
      kind: "design" as const,
      id: d.public_id,
      title: d.title,
      href: `/designs/${d.public_id}`,
      price: `approx ${formatINRRange(d.price_min, d.price_max)}`,
      photos: d.photos,
      created_at: d.created_at,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return items.flatMap((item) =>
    item.photos.map((photo) => ({
      key: photo.public_id,
      kind: item.kind,
      id: item.id,
      title: item.title,
      href: item.href,
      price: item.price,
      photo,
    })),
  );
}
```

Create `frontend/src/lib/discovery/city.ts`:

```ts
const KEY = "jewlerify.city";

/** The city a buyer last picked, offered again when location isn't available. */
export function lastCity(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberCity(city: string | null): void {
  try {
    if (city) window.localStorage.setItem(KEY, city);
  } catch {
    // Storage blocked (some private modes): nothing to remember.
  }
}
```

- [ ] **Step 6: Hooks**

Create `frontend/src/hooks/useCatalog.ts`:

```ts
import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";

/** The browsable catalogue, loaded once per page view. */
export function useCatalog() {
  return usePublicRecord("catalog", (signal) => publicService.catalog(signal));
}
```

Create `frontend/src/hooks/useSaved.ts`:

```ts
import { useSyncExternalStore } from "react";

export type SavedKind = "piece" | "design";
export const savedKey = (kind: SavedKind, id: string) => `${kind}:${id}`;

const KEY = "jewlerify.saved";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
// The source of truth while the page is open; storage is a copy so saves survive a reload when allowed.
let memory: string[] | null = null;

function read(): string[] {
  if (memory) return memory;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    memory = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    memory = [];
  }
  return memory;
}

function write(next: string[]) {
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (some private modes): saves last until the tab closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = null; // another tab changed the saves
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saved pieces and designs, kept on this device only. Newest save first. */
export function useSaved() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    saved,
    isSaved: (kind: SavedKind, id: string) => saved.includes(savedKey(kind, id)),
    toggle: (kind: SavedKind, id: string) => {
      const key = savedKey(kind, id);
      const current = read();
      write(current.includes(key) ? current.filter((k) => k !== key) : [key, ...current]);
    },
    remove: (key: string) => write(read().filter((k) => k !== key)),
  };
}
```

Create `frontend/src/hooks/useNearMe.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Point } from "@/lib/discovery/distance";

export type NearMeStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

interface NearMe {
  here: Point | null;
  status: NearMeStatus;
  /** Asks the browser once; resolves with the location, or null when refused, unavailable or unanswered. */
  request: () => Promise<Point | null>;
}

const NearMeContext = createContext<NearMe | null>(null);
const GIVE_UP_MS = 10_000;

/** Holds the buyer's location in memory for the visit, shared by every page. Never stored or sent anywhere. */
export function NearMeProvider({ children }: { children: ReactNode }) {
  const [here, setHere] = useState<Point | null>(null);
  const [status, setStatus] = useState<NearMeStatus>("idle");

  const request = useCallback(
    () =>
      new Promise<Point | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setStatus("unavailable");
          resolve(null);
          return;
        }
        setStatus("asking");
        let settled = false;
        const finish = (point: Point | null, next: NearMeStatus) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (point) setHere(point);
          setStatus(next);
          resolve(point);
        };
        // The browser's own timeout only starts after the buyer answers the prompt, so we keep our own.
        const timer = window.setTimeout(() => finish(null, "unavailable"), GIVE_UP_MS);
        navigator.geolocation.getCurrentPosition(
          (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "granted"),
          (err) => finish(null, err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
          { timeout: GIVE_UP_MS, maximumAge: 5 * 60_000 },
        );
      }),
    [],
  );

  const value = useMemo(() => ({ here, status, request }), [here, status, request]);
  return <NearMeContext.Provider value={value}>{children}</NearMeContext.Provider>;
}

export function useNearMe(): NearMe {
  const value = useContext(NearMeContext);
  if (!value) throw new Error("useNearMe must be used inside NearMeProvider");
  return value;
}
```

- [ ] **Step 7: Build**

Run: `npm --prefix frontend run build`
Expected: exits 0.

- [ ] **Step 8: Scratch logic check (not committed)**

Write `discovery-check.mjs` in the session scratchpad. It loads the TypeScript modules through Vite's SSR loader
(as in part 1) and asserts the rules:

```js
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const root = "C:/Users/arjun/buildershub/frontend";
const { createServer } = await import(pathToFileURL(`${root}/node_modules/vite/dist/node/index.js`).href);
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { searchCatalog, DEFAULT_FILTERS, activeFilterCount } = await server.ssrLoadModule("/src/lib/discovery/search.ts");
const { filtersFromParams, filtersToParams } = await server.ssrLoadModule("/src/lib/discovery/params.ts");
const { distanceKm, formatKm } = await server.ssrLoadModule("/src/lib/discovery/distance.ts");
const { feedTiles } = await server.ssrLoadModule("/src/lib/discovery/feed.ts");

const photo = (id) => ({ public_id: id, alt_text: "", alt: id, width: 600, height: 800, position: 0 });
const price = (lo, hi) => ({ final_min: String(lo), final_max: String(hi), original_min: String(lo), original_max: String(hi), discount_label: null });
const catalog = {
  gold_rate: null,
  stores: [
    { slug: "mum", name: "Shree Ganesh", area: "Zaveri Bazaar", city: "Mumbai", latitude: "18.9517", longitude: "72.8331", cover: null, piece_count: 2, design_count: 1 },
    { slug: "pun", name: "Laxmi Gold", area: "Laxmi Road", city: "Pune", latitude: "18.5204", longitude: "73.8567", cover: null, piece_count: 1, design_count: 0 },
  ],
  pieces: [
    { jewellery_id: "P3", title: "Nakshi kada", type: "Bangle", purity: "22K", net_weight: "25.9", stock_status: "in_stock", cover: photo("p3"), price: price(400000, 430000), store: "mum", photos: [photo("p3"), photo("p3b")], created_at: "2026-10-03T00:00:00Z" },
    { jewellery_id: "P2", title: "Casting ring", type: "Ring", purity: "22K", net_weight: "4.9", stock_status: "in_stock", cover: photo("p2"), price: price(75000, 78000), store: "pun", photos: [photo("p2")], created_at: "2026-10-02T00:00:00Z" },
    { jewellery_id: "P1", title: "Hollow chain", type: "Chain", purity: "18K", net_weight: "8.9", stock_status: "reserved", cover: photo("p1"), price: price(130000, 140000), store: "mum", photos: [photo("p1")], created_at: "2026-10-01T00:00:00Z" },
  ],
  designs: [
    { public_id: "D1", title: "Temple necklace", category: "Necklace", purity_options: ["22K", "18K"], weight_min: "30", weight_max: "45", price_min: "350000", price_max: "520000", cover: photo("d1"), store: "mum", photos: [photo("d1")], created_at: "2026-10-04T00:00:00Z" },
  ],
};
const ids = (r) => r.pieces.map((p) => p.jewellery_id);
const f = (patch) => ({ ...DEFAULT_FILTERS, ...patch });
const pune = { lat: 18.53, lng: 73.85 };

// distance
const d = distanceKm({ lat: 18.9517, lng: 72.8331 }, { lat: 18.5204, lng: 73.8567 });
assert.ok(d > 115 && d < 125, `Mumbai-Pune ${d}`);
assert.equal(formatKm(2.345), "2.3 km");
assert.equal(formatKm(14.6), "15 km");

// text, newest order
assert.deepEqual(ids(searchCatalog(catalog, f({}), null)), ["P3", "P2", "P1"]);
assert.deepEqual(ids(searchCatalog(catalog, f({ q: "KADA" }), null)), ["P3"]);
assert.deepEqual(ids(searchCatalog(catalog, f({ q: "zaveri" }), null)), ["P3", "P1"]); // store area
assert.deepEqual(ids(searchCatalog(catalog, f({ q: "ring pune" }), null)), ["P2"]); // every word must match

// category, purity (designs match any purity option)
assert.deepEqual(ids(searchCatalog(catalog, f({ categories: ["Ring", "Chain"] }), null)), ["P2", "P1"]);
const r18 = searchCatalog(catalog, f({ purities: ["18K"] }), null);
assert.deepEqual([ids(r18), r18.designs.length], [["P1"], 1]);

// weight and price: pieces by value / range middle, designs by overlap
assert.deepEqual(ids(searchCatalog(catalog, f({ weightMin: 5, weightMax: 10 }), null)), ["P1"]);
assert.deepEqual(ids(searchCatalog(catalog, f({ priceMax: 136000 }), null)), ["P2", "P1"]); // P1 middle 135000
assert.equal(searchCatalog(catalog, f({ priceMin: 500000 }), null).designs.length, 1); // 350000-520000 overlaps
assert.equal(searchCatalog(catalog, f({ priceMin: 600000 }), null).designs.length, 0);

// sorts
assert.deepEqual(ids(searchCatalog(catalog, f({ sort: "price_asc" }), null)), ["P2", "P1", "P3"]);
assert.deepEqual(ids(searchCatalog(catalog, f({ sort: "price_desc" }), null)), ["P3", "P1", "P2"]);
assert.deepEqual(ids(searchCatalog(catalog, f({ sort: "nearest" }), null)), ["P3", "P2", "P1"]); // no location: newest
const near = searchCatalog(catalog, f({ sort: "nearest" }), pune);
assert.deepEqual(ids(near), ["P2", "P3", "P1"]);
assert.ok(near.pieces[0].distanceKm < 5);

// distance filter: ignored without a location, applied with one
assert.equal(searchCatalog(catalog, f({ km: 5 }), null).pieces.length, 3);
assert.deepEqual(ids(searchCatalog(catalog, f({ km: 5 }), pune)), ["P2"]);

// city, stores tab sorting
assert.deepEqual(ids(searchCatalog(catalog, f({ city: "Mumbai" }), null)), ["P3", "P1"]);
assert.deepEqual(searchCatalog(catalog, f({}), null).stores.map((s) => s.slug), ["pun", "mum"]); // by name
assert.deepEqual(searchCatalog(catalog, f({ sort: "nearest" }), pune).stores.map((s) => s.slug), ["pun", "mum"]);
assert.equal(activeFilterCount(f({ categories: ["Ring"], purities: ["22K"], priceMin: 1, km: 5 })), 4);

// URL round trip and junk
const full = f({ q: "kada", tab: "designs", categories: ["Ring"], purities: ["22K", "18K"], weightMin: 2, priceMax: 90000, km: 10, city: "Mumbai", sort: "price_desc" });
assert.deepEqual(filtersFromParams(filtersToParams(full)), full);
assert.equal(filtersToParams(DEFAULT_FILTERS).toString(), "");
assert.deepEqual(filtersFromParams(new URLSearchParams("tab=x&cat=Foo,Ring&wmin=-3&pmax=abc&km=7&sort=bogus")),
  f({ categories: ["Ring"] }));

// feed: newest item first, one tile per photo
assert.deepEqual(feedTiles(catalog).map((t) => t.key), ["d1", "p3", "p3b", "p2", "p1"]);
assert.equal(feedTiles(catalog)[0].price, "approx ₹3,50,000 – ₹5,20,000");

console.log("discovery logic: all checks passed");
await server.close();
```

Run: `node <scratchpad>/discovery-check.mjs`
Expected: `discovery logic: all checks passed`. If the Vite path differs, find it with
`ls frontend/node_modules/vite/dist/node/` and adjust the import (ledger it as a ruling).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/public.ts frontend/src/lib/discovery frontend/src/hooks/useCatalog.ts frontend/src/hooks/useSaved.ts frontend/src/hooks/useNearMe.tsx
git commit -m "Add the catalogue search, saves and Near me logic"
```

---

### Task 3: Shared discovery components and the header

**Files:**
- Create: `frontend/src/components/public/StoreTile.tsx`
- Create: `frontend/src/components/public/SaveButton.tsx`
- Create: `frontend/src/components/public/NearMeButton.tsx`
- Create: `frontend/src/components/public/GoldRateStrip.tsx`
- Modify: `frontend/src/components/public/PieceTile.tsx`, `frontend/src/components/public/DesignTile.tsx` (optional distance)
- Modify: `frontend/src/components/layout/PublicLayout.tsx` (nav, footer login link, `NearMeProvider`)

**Interfaces:**
- Consumes: Task 2 (`useNearMe`, `useSaved`, `formatKm`, `Point`, `CatalogStore`, `publicService.goldRate`);
  `LiveDot` from `@/components/verify/GoldRateTicker`; `formatAgo`, `formatINR` from `@/utils/format`.
- Produces: `StoreTile({ store, distanceKm? })`, `SaveButton({ kind, id, title, variant?, className? })`,
  `NearMeButton({ onResult, tone?, className? })`, `GoldRateStrip()`, `PieceTile({ piece, distanceKm? })`,
  `DesignTile({ design, distanceKm? })`.

- [ ] **Step 1: Distance on the existing tiles**

In `frontend/src/components/public/PieceTile.tsx`:
- add `import { formatKm } from "@/lib/discovery/distance";`;
- change the signature to `export function PieceTile({ piece, distanceKm }: { piece: PieceCard; distanceKm?: number | null }) {`;
- after the `{piece.purity} · {formatWeight(piece.net_weight)}` paragraph, add:

```tsx
      {distanceKm != null && <p className="text-[13px] text-muted">{formatKm(distanceKm)} away</p>}
```

In `frontend/src/components/public/DesignTile.tsx`, make the same three changes (signature
`{ design, distanceKm }: { design: DesignCard; distanceKm?: number | null }`, the line after the purity/weight
paragraph).

- [ ] **Step 2: Store tile**

Create `frontend/src/components/public/StoreTile.tsx`:

```tsx
import { Store } from "lucide-react";
import { Link } from "react-router-dom";
import { formatKm } from "@/lib/discovery/distance";
import { photoService } from "@/services/photos";
import type { CatalogStore } from "@/types";

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function StoreTile({ store, distanceKm }: { store: CatalogStore; distanceKm?: number | null }) {
  const { cover } = store;
  return (
    <Link to={`/stores/${store.slug}`} className="group block min-w-0">
      <div className="overflow-hidden rounded-md border border-line bg-chalk">
        {cover ? (
          <img
            src={photoService.url(cover.public_id, "thumb")}
            alt=""
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-muted">
            <Store className="size-6" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{store.name}</p>
      <p className="truncate text-[13px] text-muted">
        {store.area}, {store.city}
      </p>
      <p className="text-[13px] text-muted">
        {count(store.piece_count, "piece")}
        {store.design_count > 0 && ` · ${count(store.design_count, "design")}`}
        {distanceKm != null && ` · ${formatKm(distanceKm)}`}
      </p>
    </Link>
  );
}
```

- [ ] **Step 3: Save button**

Create `frontend/src/components/public/SaveButton.tsx`:

```tsx
import { Heart } from "lucide-react";
import { useSaved, type SavedKind } from "@/hooks/useSaved";
import { cn } from "@/utils/cn";

interface SaveButtonProps {
  kind: SavedKind;
  id: string;
  title: string;
  /** "overlay" sits on a photo; "inline" sits beside a heading. */
  variant?: "overlay" | "inline";
  className?: string;
}

/** Saves a piece or design on this device. Never inside a link, so it is its own tap target. */
export function SaveButton({ kind, id, title, variant = "overlay", className }: SaveButtonProps) {
  const { isSaved, toggle } = useSaved();
  const on = isSaved(kind, id);
  return (
    <button
      type="button"
      onClick={() => toggle(kind, id)}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from saved` : `Save ${title}`}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full transition-colors active:scale-95",
        variant === "overlay" ? "bg-white/90 text-ink shadow-md hover:bg-white" : "border border-line-strong bg-white text-ink hover:border-basalt/40",
        className,
      )}
    >
      <Heart className={cn("size-5", on && "fill-danger text-danger")} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 4: Near me button**

Create `frontend/src/components/public/NearMeButton.tsx`:

```tsx
import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { useNearMe } from "@/hooks/useNearMe";
import type { Point } from "@/lib/discovery/distance";
import { cn } from "@/utils/cn";

interface NearMeButtonProps {
  /** Called with the location, or null when it isn't available. */
  onResult: (here: Point | null) => void;
  tone?: "light" | "dark";
  className?: string;
}

/** Says why before the browser asks, so the prompt never comes out of nowhere. */
export function NearMeButton({ onResult, tone = "light", className }: NearMeButtonProps) {
  const { here, status, request } = useNearMe();
  const [explaining, setExplaining] = useState(false);
  const dark = tone === "dark";

  if (explaining) {
    return (
      <div
        role="group"
        aria-label="Use your location"
        className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm", dark ? "border-white/25 text-chalk" : "border-line-strong bg-white text-ink", className)}
      >
        <p className="min-w-0 flex-1 basis-56">Your location stays on this device and is only used to sort by distance.</p>
        <button
          type="button"
          className="font-semibold underline-offset-4 hover:underline"
          onClick={async () => {
            setExplaining(false);
            onResult(await request());
          }}
        >
          Continue
        </button>
        <button type="button" className={cn("underline-offset-4 hover:underline", dark ? "text-chalk/70" : "text-muted")} onClick={() => setExplaining(false)}>
          Not now
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (here ? onResult(here) : setExplaining(true))}
      disabled={status === "asking"}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-60",
        dark ? "border-white/30 text-chalk hover:border-gold-bright hover:text-gold-bright" : "border-line-strong bg-white text-ink hover:border-basalt/40",
        className,
      )}
    >
      <LocateFixed className="size-4" strokeWidth={1.75} aria-hidden />
      {status === "asking" ? "Finding you…" : here ? "Near me ✓" : "Near me"}
    </button>
  );
}
```

- [ ] **Step 5: Gold rate strip**

Create `frontend/src/components/public/GoldRateStrip.tsx`:

```tsx
import { useEffect, useState } from "react";
import { LiveDot } from "@/components/verify/GoldRateTicker";
import { publicService } from "@/services/public";
import type { GoldRate } from "@/types";
import { formatAgo, formatINR } from "@/utils/format";

const REFRESH_MS = 60_000;

/** 24K and 22K per gram. Keeps the last rate it had when a refresh fails; never blank. */
export function GoldRateStrip() {
  // undefined: first load still running; null: no rate available.
  const [rate, setRate] = useState<GoldRate | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      publicService
        .goldRate()
        .then((next) => alive && setRate((prev) => next ?? prev ?? null))
        .catch(() => alive && setRate((prev) => prev ?? null));
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section aria-label="Gold rate" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold text-gold-deep">
          <LiveDot /> Gold rate
        </span>
        {rate === undefined ? (
          <span className="text-muted">Loading…</span>
        ) : rate === null ? (
          <span className="text-muted">Gold rate unavailable right now</span>
        ) : (
          <>
            <span className="tabular text-ink">
              24K <strong className="font-semibold">{formatINR(rate.per_gram["24K"])}</strong>/g
            </span>
            <span className="tabular text-ink">
              22K <strong className="font-semibold">{formatINR(rate.per_gram["22K"])}</strong>/g
            </span>
            <span className="text-muted">Updated {formatAgo(rate.updated_at)}</span>
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Header, footer and provider**

In `frontend/src/components/layout/PublicLayout.tsx`:
- change the router import to `import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router-dom";`
  and add `import { NearMeProvider } from "@/hooks/useNearMe";`;
- above `export function PublicHeader()`, add:

```tsx
const NAV = [
  { to: "/search", label: "Browse", short: "Browse" },
  { to: "/feed", label: "Feed", short: "Feed" },
  { to: "/verify", label: "Verify jewellery", short: "Verify" },
] as const;
```

- replace the existing `/verify` `<Link>` inside `<nav>` with:

```tsx
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-2 transition-colors sm:px-3",
                  onHome ? "text-chalk/80 hover:text-chalk" : "text-ink hover:bg-basalt-50",
                  isActive && (onHome ? "text-chalk" : "font-medium"),
                )
              }
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
```

- on the "Jeweller login" `<Link>`, prepend `hidden sm:inline-flex ` to its first class string
  (`"hidden sm:inline-flex rounded-md border px-3.5 py-2 font-medium transition-colors"`);
- in `PublicFooter`, replace `<p className="shrink-0">© {new Date().getFullYear()} Jewlerify</p>` with:

```tsx
        <div className="flex shrink-0 items-center gap-4">
          <Link to="/admin/login" className="underline-offset-4 hover:text-ink hover:underline sm:hidden">
            Jeweller login
          </Link>
          <p>© {new Date().getFullYear()} Jewlerify</p>
        </div>
```

- wrap the returned layout in the provider:

```tsx
  return (
    <NearMeProvider>
      <div className="flex min-h-dvh flex-col">
        ...unchanged...
      </div>
    </NearMeProvider>
  );
```

- [ ] **Step 7: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0.

```bash
git add frontend/src/components/public frontend/src/components/layout/PublicLayout.tsx
git commit -m "Add store tiles, saves, Near me and the gold rate strip, and link Browse and Feed in the header"
```

---

### Task 4: Search page

**Files:**
- Create: `frontend/src/components/search/FilterPanel.tsx`
- Create: `frontend/src/pages/SearchPage.tsx`
- Modify: `frontend/src/App.tsx` (route `search`)

**Interfaces:**
- Consumes: Task 2 (`Filters`, `DEFAULT_FILTERS`, `DISTANCES`, `searchCatalog`, `activeFilterCount`,
  `filtersFromParams`, `filtersToParams`, `useCatalog`, `useNearMe`, `lastCity`, `rememberCity`); Task 3
  (`NearMeButton`, `StoreTile`, `PieceTile`/`DesignTile` with `distanceKm`); `Unavailable`; `Skeleton`.
- Produces: route `/search`; reads optional router state `{ pickCity: true }` (set by the home page's Near me
  when location isn't available).

- [ ] **Step 1: Filter panel**

Create `frontend/src/components/search/FilterPanel.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { DISTANCES, type Filters } from "@/lib/discovery/search";
import { JEWELLERY_TYPES, PURITIES } from "@/types";
import { cn } from "@/utils/cn";

interface FilterPanelProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  hasLocation: boolean;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <legend className="mb-2.5 text-[13px] font-semibold text-gold-deep">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40",
        on ? "border-basalt bg-basalt text-chalk" : "border-line-strong bg-white text-ink hover:border-basalt/40",
      )}
    >
      {children}
    </button>
  );
}

/** A number box that lets the buyer type freely ("1.", "") and only reports a value once it reads as one. */
function NumberBox({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        placeholder={label}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setText(next);
          if (next === "") onCommit(null);
          else if (/^\d+(\.\d+)?$/.test(next)) onCommit(Number(next));
        }}
        className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-basalt focus:outline-none"
      />
    </label>
  );
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function FilterPanel({ filters, onChange, hasLocation }: FilterPanelProps) {
  const forStores = filters.tab === "stores";
  return (
    <div>
      {!forStores && (
        <>
          <Group title="Category">
            <div className="flex flex-wrap gap-2">
              {JEWELLERY_TYPES.map((c) => (
                <Chip key={c} on={filters.categories.includes(c)} onClick={() => onChange({ categories: toggle(filters.categories, c) })}>
                  {c}
                </Chip>
              ))}
            </div>
          </Group>
          <Group title="Purity">
            <div className="flex flex-wrap gap-2">
              {PURITIES.map((p) => (
                <Chip key={p} on={filters.purities.includes(p)} onClick={() => onChange({ purities: toggle(filters.purities, p) })}>
                  {p}
                </Chip>
              ))}
            </div>
          </Group>
          <Group title="Weight (g)">
            <div className="flex gap-2">
              <NumberBox label="Min weight" value={filters.weightMin} onCommit={(v) => onChange({ weightMin: v })} />
              <NumberBox label="Max weight" value={filters.weightMax} onCommit={(v) => onChange({ weightMax: v })} />
            </div>
          </Group>
          <Group title="Price (₹)">
            <div className="flex gap-2">
              <NumberBox label="Min price" value={filters.priceMin} onCommit={(v) => onChange({ priceMin: v })} />
              <NumberBox label="Max price" value={filters.priceMax} onCommit={(v) => onChange({ priceMax: v })} />
            </div>
          </Group>
        </>
      )}
      <Group title="Distance">
        <div className="flex flex-wrap gap-2">
          <Chip on={filters.km === null} onClick={() => onChange({ km: null })}>
            Any
          </Chip>
          {DISTANCES.map((km) => (
            <Chip key={km} on={filters.km === km} disabled={!hasLocation} onClick={() => onChange({ km })}>
              {km} km
            </Chip>
          ))}
        </div>
        {!hasLocation && <p className="mt-2 text-[13px] text-muted">Use Near me to filter by distance.</p>}
      </Group>
    </div>
  );
}
```

- [ ] **Step 2: The page**

Create `frontend/src/pages/SearchPage.tsx`:

```tsx
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { NearMeButton } from "@/components/public/NearMeButton";
import { PieceTile } from "@/components/public/PieceTile";
import { StoreTile } from "@/components/public/StoreTile";
import { Unavailable } from "@/components/public/Unavailable";
import { FilterPanel } from "@/components/search/FilterPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useNearMe } from "@/hooks/useNearMe";
import { lastCity, rememberCity } from "@/lib/discovery/city";
import type { Point } from "@/lib/discovery/distance";
import { filtersFromParams, filtersToParams } from "@/lib/discovery/params";
import { activeFilterCount, DEFAULT_FILTERS, searchCatalog, TABS, type Filters, type Tab } from "@/lib/discovery/search";
import { cn } from "@/utils/cn";

const TAB_LABEL: Record<Tab, string> = { pieces: "Pieces", designs: "Designs", stores: "Stores" };
const NO_LOCATION = "Location isn't available. Pick a city instead.";

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const { state, retry } = useCatalog();
  const { here } = useNearMe();
  const routerState = useLocation().state as { pickCity?: boolean } | null;
  const [note, setNote] = useState<string | null>(routerState?.pickCity ? NO_LOCATION : null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cityRef = useRef<HTMLSelectElement>(null);

  const update = (patch: Partial<Filters>, push = false) =>
    setParams(filtersToParams({ ...filters, ...patch }), { replace: !push });

  const catalog = state.kind === "found" ? state.data : null;
  const results = useMemo(() => (catalog ? searchCatalog(catalog, filters, here) : null), [catalog, filters, here]);
  const cities = useMemo(() => (catalog ? [...new Set(catalog.stores.map((s) => s.city))].sort() : []), [catalog]);
  const panelCount = activeFilterCount(filters);
  const shown = results ? results[filters.tab].length : 0;

  useEffect(() => {
    document.title = "Browse jewellery";
  }, []);
  // Arrived from the home page's Near me without a location: offer the city picker.
  useEffect(() => {
    if (routerState?.pickCity) cityRef.current?.focus();
  }, [routerState]);
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const onNearMe = (point: Point | null) => {
    if (point) {
      setNote(null);
      update({ sort: "nearest" });
      return;
    }
    setNote(NO_LOCATION);
    const remembered = lastCity();
    if (!filters.city && remembered && cities.includes(remembered)) update({ city: remembered });
    cityRef.current?.focus();
  };

  const clear = () => setParams(filtersToParams({ ...DEFAULT_FILTERS, tab: filters.tab, sort: filters.sort }), { replace: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[40px]">Browse jewellery</h1>

      <form role="search" className="mt-5" onSubmit={(e) => e.preventDefault()}>
        <label className="relative block">
          <span className="sr-only">Search pieces, designs and stores</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search rings, necklaces, store names, areas"
            className="h-12 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-muted focus:border-basalt focus:outline-none"
          />
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NearMeButton onResult={onNearMe} />
        <label className="min-w-0">
          <span className="sr-only">City</span>
          <select
            ref={cityRef}
            value={filters.city ?? ""}
            onChange={(e) => {
              const city = e.target.value || null;
              rememberCity(city);
              update({ city });
            }}
            className="h-11 rounded-md border border-line-strong bg-white px-3 text-sm text-ink"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Sort</span>
          <select
            value={filters.sort === "nearest" && !here ? "newest" : filters.sort}
            onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
            className="h-11 rounded-md border border-line-strong bg-white px-3 text-sm text-ink"
          >
            <option value="newest">{filters.tab === "stores" ? "A to Z" : "Newest"}</option>
            {filters.tab !== "stores" && <option value="price_asc">Price: low to high</option>}
            {filters.tab !== "stores" && <option value="price_desc">Price: high to low</option>}
            {here && <option value="nearest">Nearest</option>}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-white px-4 text-sm font-medium text-ink lg:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters{panelCount > 0 && ` (${panelCount})`}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-ink">
          {note}
        </p>
      )}

      <div role="tablist" aria-label="Results" className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab}
            onClick={() => update({ tab }, true)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
              filters.tab === tab ? "border-basalt font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {TAB_LABEL[tab]}
            {results && <span className="tabular ml-1.5 text-muted">{results[tab].length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <FilterPanel filters={filters} onChange={(patch) => update(patch)} hasLocation={here !== null} />
          {panelCount > 0 && (
            <button type="button" onClick={clear} className="mt-2 text-sm font-medium text-basalt underline-offset-4 hover:underline">
              Clear filters
            </button>
          )}
        </aside>

        <div role="tabpanel" aria-label={TAB_LABEL[filters.tab]}>
          {state.kind === "loading" && (
            <Grid>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full" />
              ))}
            </Grid>
          )}
          {(state.kind === "error" || state.kind === "not-found" || state.kind === "gone") && (
            <Unavailable
              title="Couldn't load the catalogue"
              body={state.kind === "error" ? state.message : "Try again in a moment."}
              onRetry={retry}
            />
          )}
          {results && shown === 0 && (
            <div className="rounded-lg border border-line bg-white px-6 py-12 text-center">
              <p className="font-display text-[24px] text-ink">Nothing matches these filters</p>
              <button type="button" onClick={clear} className="mt-3 text-sm font-medium text-basalt underline-offset-4 hover:underline">
                Clear filters
              </button>
            </div>
          )}
          {results && shown > 0 && (
            <Grid>
              {filters.tab === "pieces" &&
                results.pieces.map((p) => <PieceTile key={p.jewellery_id} piece={p} distanceKm={p.distanceKm} />)}
              {filters.tab === "designs" &&
                results.designs.map((d) => <DesignTile key={d.public_id} design={d} distanceKm={d.distanceKm} />)}
              {filters.tab === "stores" &&
                results.stores.map((s) => <StoreTile key={s.slug} store={s} distanceKm={s.distanceKm} />)}
            </Grid>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-basalt/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-xl bg-chalk">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold text-ink">Filters</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close filters" className="grid size-10 place-items-center rounded-full hover:bg-basalt-50">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 py-4">
              <FilterPanel filters={filters} onChange={(patch) => update(patch)} hasLocation={here !== null} />
            </div>
            <div className="flex gap-3 border-t border-line px-4 py-3">
              <button type="button" onClick={clear} className="h-12 flex-1 rounded-md border border-line-strong bg-white text-sm font-medium text-ink">
                Clear
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="h-12 flex-[2] rounded-md bg-basalt text-sm font-medium text-chalk">
                Show {shown} {shown === 1 ? "result" : "results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Route**

In `frontend/src/App.tsx`, add `import { SearchPage } from "@/pages/SearchPage";` and, after the `designs/:id`
route, `<Route path="search" element={<SearchPage />} />`.

- [ ] **Step 4: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0.

```bash
git add frontend/src/components/search frontend/src/pages/SearchPage.tsx frontend/src/App.tsx
git commit -m "Add the search page with filters, tabs and Near me"
```

---

### Task 5: Home page

**Files:**
- Create: `frontend/public/hero/rani-haar.jpg` (from `backend/seed_photos/rani-haar.jpg`)
- Create: `frontend/src/components/landing/CatalogRows.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx` (new hero, strip, rows)
- Delete: `frontend/src/components/landing/HeroVisual.tsx` (only the old hero used it)

**Interfaces:**
- Consumes: `GoldRateStrip`, `NearMeButton`, `StoreTile`, `PieceTile` (Task 3); `useCatalog`, `useNearMe` (Task 2).
- Produces: nothing for later tasks.

Ruling carried from the spec: the source photo is 586 x 783 px, so the spec's 1600 x 900 / 800 x 1000 exports
would be upscales. One native-size file is shipped instead; on phones it fills the hero behind a gradient, and
from `lg` it fills the right half, fading into basalt under the text.

- [ ] **Step 1: The hero image**

Run (re-encodes without metadata, progressive, quality 80):

```bash
mkdir -p frontend/public/hero && backend/.venv/Scripts/python -c "from PIL import Image, ImageOps; im = ImageOps.exif_transpose(Image.open('backend/seed_photos/rani-haar.jpg')).convert('RGB'); im.save('frontend/public/hero/rani-haar.jpg', 'JPEG', quality=80, optimize=True, progressive=True); print(im.size)"
```

Expected: `(586, 783)`.

- [ ] **Step 2: Catalogue rows**

Create `frontend/src/components/landing/CatalogRows.tsx`:

```tsx
import { ArrowRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PieceTile } from "@/components/public/PieceTile";
import { StoreTile } from "@/components/public/StoreTile";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useNearMe } from "@/hooks/useNearMe";
import { distanceKm } from "@/lib/discovery/distance";

function Row({ title, link, children }: { title: string; link: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-[28px] leading-tight text-ink sm:text-[34px]">{title}</h2>
        <Link to={link.to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-basalt underline-offset-4 hover:underline">
          {link.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {/* Phones scroll sideways; wider screens get a grid. */}
      <div className="-mx-4 mt-5 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

const cell = "w-40 shrink-0 snap-start sm:w-auto";

/** Stores and the newest pieces, from the catalogue. Each row hides when empty. */
export function CatalogRows() {
  const { state, retry } = useCatalog();
  const { here } = useNearMe();
  const catalog = state.kind === "found" ? state.data : null;
  const stores = useMemo(() => {
    if (!catalog) return [];
    const located = catalog.stores.map((s) => ({
      store: s,
      km: here ? distanceKm(here, { lat: Number(s.latitude), lng: Number(s.longitude) }) : null,
    }));
    return here ? located.sort((a, b) => (a.km ?? 0) - (b.km ?? 0)) : located;
  }, [catalog, here]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4 sm:px-6" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    );
  }
  if (!catalog) {
    return (
      <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
        Couldn't load the catalogue.{" "}
        <button type="button" onClick={retry} className="font-medium text-basalt underline-offset-4 hover:underline">
          Try again
        </button>
      </p>
    );
  }

  return (
    <>
      {stores.length > 0 && (
        <Row title="Stores" link={{ to: "/search?tab=stores", label: "All stores" }}>
          {stores.map(({ store, km }) => (
            <div key={store.slug} className={cell}>
              <StoreTile store={store} distanceKm={km} />
            </div>
          ))}
        </Row>
      )}
      {catalog.pieces.length > 0 && (
        <Row title="New pieces" link={{ to: "/search", label: "See all" }}>
          {catalog.pieces.slice(0, 8).map((piece) => (
            <div key={piece.jewellery_id} className={cell}>
              <PieceTile piece={piece} />
            </div>
          ))}
        </Row>
      )}
    </>
  );
}
```

- [ ] **Step 3: The new hero**

In `frontend/src/pages/LandingPage.tsx`:
- remove `import { HeroVisual } from "@/components/landing/HeroVisual";` and delete
  `frontend/src/components/landing/HeroVisual.tsx`;
- add imports: `import { Search } from "lucide-react";`, `import { useNavigate } from "react-router-dom";` (merge
  into the existing react-router-dom import), `import { CatalogRows } from "@/components/landing/CatalogRows";`,
  `import { GoldRateStrip } from "@/components/public/GoldRateStrip";`,
  `import { NearMeButton } from "@/components/public/NearMeButton";`;
- change the document title to `"Jewlerify: verified gold jewellery near you"`;
- inside `LandingPage`, before `return`, add `const navigate = useNavigate();`;
- replace the whole `{/* Hero */}` `<section>` with:

```tsx
      {/* Hero: the store's own photo; the gradient keeps the text readable over it. */}
      <section className="relative isolate overflow-hidden bg-basalt text-chalk">
        <img
          src="/hero/rani-haar.jpg"
          alt=""
          width={586}
          height={783}
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_30%] lg:left-1/2 lg:w-1/2"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-basalt via-basalt/85 to-basalt/40 lg:bg-gradient-to-r lg:from-basalt lg:from-45% lg:via-basalt/70 lg:via-60% lg:to-transparent"
        />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-36 lg:pb-28 lg:pt-24">
          <div className="max-w-xl">
            <h1 className="rise font-display text-[46px] leading-[0.98] sm:text-[68px] lg:text-[80px]">
              Find verified gold jewellery near you.
            </h1>
            <p className="rise mt-6 max-w-md text-lg leading-relaxed text-chalk/80" style={delay(140)}>
              Browse pieces from local stores, check how each one is verified, and choose where to visit.
            </p>
            <form
              role="search"
              className="rise mt-8 flex gap-2"
              style={delay(220)}
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get("q")?.toString().trim();
                navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
              }}
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search jewellery</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  name="q"
                  type="search"
                  placeholder="Rings, necklaces, a store or area"
                  className="h-12 w-full rounded-md border-0 bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-gold-bright"
                />
              </label>
              <button type="submit" className={cn(buttonVariants({ size: "lg", variant: "gold" }))}>
                Search
              </button>
            </form>
            <div className="rise mt-3 flex flex-wrap items-center gap-x-5 gap-y-3" style={delay(300)}>
              <NearMeButton
                tone="dark"
                onResult={(here) =>
                  here
                    ? navigate("/search?tab=stores&sort=nearest")
                    : navigate("/search?tab=stores", { state: { pickCity: true } })
                }
              />
              <Link to="/verify" className="text-sm font-medium text-chalk/85 underline-offset-4 hover:text-gold-bright hover:underline">
                Verify a tag
              </Link>
            </div>
          </div>
        </div>
      </section>

      <GoldRateStrip />
      <CatalogRows />
```

- [ ] **Step 4: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0 (fails if anything else still imports `HeroVisual`).

```bash
git add frontend/public/hero frontend/src/components/landing frontend/src/pages/LandingPage.tsx
git commit -m "Rebuild the home page around browsing: photo hero, gold rate, stores and new pieces"
```

---

### Task 6: Feed page and saves on piece and design pages

**Files:**
- Create: `frontend/src/pages/FeedPage.tsx`
- Modify: `frontend/src/App.tsx` (route `feed`)
- Modify: `frontend/src/pages/VerifyPage.tsx` (heart beside the title)
- Modify: `frontend/src/pages/DesignPage.tsx` (heart beside the title)

**Interfaces:**
- Consumes: `feedTiles`, `FeedTile` (Task 2); `useCatalog`, `useSaved`, `savedKey` (Task 2); `SaveButton`,
  `PieceTile`, `DesignTile` (Tasks 3, part 2); `Unavailable`; `photoService.url`.
- Produces: route `/feed` (`?view=saved` for the Saved view).

- [ ] **Step 1: The page**

Create `frontend/src/pages/FeedPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { PieceTile } from "@/components/public/PieceTile";
import { SaveButton } from "@/components/public/SaveButton";
import { Unavailable } from "@/components/public/Unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useSaved } from "@/hooks/useSaved";
import { feedTiles, type FeedTile } from "@/lib/discovery/feed";
import { photoService } from "@/services/photos";
import type { Catalog } from "@/types";
import { cn } from "@/utils/cn";

const PAGE = 30;

function Tile({ tile }: { tile: FeedTile }) {
  return (
    <div className="relative mb-3 break-inside-avoid">
      <Link to={tile.href} className="group block">
        <img
          src={photoService.url(tile.photo.public_id, "thumb")}
          alt={tile.photo.alt}
          width={tile.photo.width}
          height={tile.photo.height}
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-md border border-line bg-chalk"
        />
        <p className="mt-1.5 truncate text-[14px] font-medium text-ink group-hover:underline">{tile.title}</p>
        <p className="tabular truncate text-[13px] text-muted">{tile.price}</p>
      </Link>
      <SaveButton kind={tile.kind} id={tile.id} title={tile.title} className="absolute right-2 top-2" />
    </div>
  );
}

function SavedView({ catalog }: { catalog: Catalog }) {
  const { saved, remove } = useSaved();
  if (saved.length === 0) {
    return <p className="rounded-lg border border-line bg-white px-6 py-12 text-center text-[15px] text-muted">Nothing saved yet. Tap the heart on any photo to keep it here.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {saved.map((key) => {
        const [kind, id] = key.split(/:(.*)/s);
        const piece = kind === "piece" ? catalog.pieces.find((p) => p.jewellery_id === id) : undefined;
        const design = kind === "design" ? catalog.designs.find((d) => d.public_id === id) : undefined;
        if (piece || design) {
          const title = piece?.title ?? design!.title;
          return (
            <div key={key} className="relative">
              {piece ? <PieceTile piece={piece} /> : <DesignTile design={design!} />}
              <SaveButton kind={kind as "piece" | "design"} id={id} title={title} className="absolute right-2 top-2" />
            </div>
          );
        }
        return (
          <div key={key} className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-strong bg-white p-4 text-center">
            <p className="text-sm text-muted">No longer available</p>
            <button type="button" onClick={() => remove(key)} className="text-sm font-medium text-basalt underline-offset-4 hover:underline">
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "saved" ? "saved" : "all";
  const { state, retry } = useCatalog();
  const { saved } = useSaved();
  const [count, setCount] = useState(PAGE);
  const tiles = useMemo(() => (state.kind === "found" ? feedTiles(state.data) : []), [state]);

  useEffect(() => {
    document.title = view === "saved" ? "Saved jewellery" : "Jewellery feed";
  }, [view]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[40px]">Feed</h1>
        <div role="tablist" aria-label="Feed view" className="flex rounded-md border border-line-strong bg-white p-1">
          {(["all", "saved"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setParams(v === "saved" ? { view: "saved" } : {}, { replace: true })}
              className={cn("rounded px-4 py-2 text-sm transition-colors", view === v ? "bg-basalt text-chalk" : "text-ink hover:bg-basalt-50")}
            >
              {v === "all" ? "All" : `Saved (${saved.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" role="tabpanel" aria-label={view === "saved" ? "Saved" : "All photos"}>
        {state.kind === "loading" && (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={cn("mb-3 w-full", i % 2 ? "aspect-[3/4]" : "aspect-square")} />
            ))}
          </div>
        )}
        {state.kind !== "loading" && state.kind !== "found" && (
          <Unavailable title="Couldn't load the catalogue" body={state.kind === "error" ? state.message : "Try again in a moment."} onRetry={retry} />
        )}
        {state.kind === "found" && view === "saved" && <SavedView catalog={state.data} />}
        {state.kind === "found" && view === "all" && (
          <>
            {tiles.length === 0 ? (
              <p className="text-[15px] text-muted">No photos yet.</p>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {tiles.slice(0, count).map((tile) => (
                  <Tile key={tile.key} tile={tile} />
                ))}
              </div>
            )}
            {count < tiles.length && (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => setCount((n) => n + PAGE)} className="h-11 rounded-md border border-line-strong bg-white px-6 text-sm font-medium text-ink hover:border-basalt/40">
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route**

In `frontend/src/App.tsx`, add `import { FeedPage } from "@/pages/FeedPage";` and, after the `search` route,
`<Route path="feed" element={<FeedPage />} />`.

- [ ] **Step 3: Hearts on the piece and design pages**

In `frontend/src/pages/VerifyPage.tsx`, add `import { SaveButton } from "@/components/public/SaveButton";` and
replace the title line

```tsx
            <h2 className="mt-1.5 font-display text-[26px] leading-tight text-ink">{record.title}</h2>
```

with

```tsx
            <div className="mt-1.5 flex items-start gap-3">
              <h2 className="min-w-0 font-display text-[26px] leading-tight text-ink">{record.title}</h2>
              <SaveButton kind="piece" id={record.jewellery_id} title={record.title} variant="inline" />
            </div>
```

In `frontend/src/pages/DesignPage.tsx`, add the same import and replace the `<h1 ...>{design.title}</h1>` line with

```tsx
        <div className="mt-3 flex items-start gap-3">
          <h1 className="min-w-0 break-words font-display text-[32px] leading-tight text-ink sm:text-[38px]">{design.title}</h1>
          <SaveButton kind="design" id={design.public_id} title={design.title} variant="inline" className="mt-1" />
        </div>
```

- [ ] **Step 4: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0.

```bash
git add frontend/src/pages/FeedPage.tsx frontend/src/App.tsx frontend/src/pages/VerifyPage.tsx frontend/src/pages/DesignPage.tsx
git commit -m "Add the photo feed with saves, and save buttons on piece and design pages"
```

---

### Task 7: Browser checks and screenshots

**Files:**
- No product files unless a check fails; any fix is its own commit with a ledgered ruling.
- Scratch (not committed): `discovery-browser.mjs` in the session scratchpad.

**Interfaces:**
- Consumes: everything above, running on the local stack.

- [ ] **Step 1: Start the local stack**

`docker compose up -d db`; in `backend`, `.venv/Scripts/python -m uvicorn app.main:app --port 8010` (background);
in `frontend`, `npm run dev` (background). Read the Vite log for the actual port (5173 may be taken; part 2 got
5176) and use it below as `$BASE`.

- [ ] **Step 2: Scripted checks over the DevTools protocol**

Write `discovery-browser.mjs` (same launcher as part 2's `shot.mjs`/`interact.mjs`: headless Chrome with
`--remote-debugging-port`, a WebSocket client, `send(method, params)` and `ev(expression)` helpers), taking
`$BASE` as its argument, and check, printing PASS/FAIL per line:

1. `/search?cat=Ring` at 390 px: every rendered piece tile's category is Ring (read `[href^="/verify/"]` count vs
   the catalogue's Ring count from `fetch('/api/public/catalog')`); `document.documentElement.scrollWidth === 390`.
2. Typing into the search box (`Input.insertText` after focusing it) updates `location.search` with `q=` and
   narrows the tile count.
3. Near me granted: `Browser.grantPermissions({ permissions: ["geolocation"], origin: $BASE })` and
   `Emulation.setGeolocationOverride({ latitude: 18.9398, longitude: 72.8355, accuracy: 10 })`; on `/search`,
   click Near me, then Continue; within 3 s the sort select's value is `nearest`, a "km" label appears on a tile,
   and `location.search` contains no `18.93`.
4. Near me denied: fresh page with `Browser.resetPermissions` and
   `Browser.setPermission({ permission: { name: "geolocation" }, setting: "denied", origin: $BASE })`; click Near
   me, Continue; the text "Location isn't available. Pick a city instead." appears and `document.activeElement` is
   the city select.
5. From the home page: click Near me, Continue (granted as in 3) and land on `/search?tab=stores&sort=nearest`.
6. Feed: on `/feed`, click the first `button[aria-pressed="false"]`; it becomes `aria-pressed="true"`; the Saved
   tab label reads `Saved (1)`; reload; `/feed?view=saved` shows one tile.
7. Saved but gone: `localStorage.setItem("jewlerify.saved", '["piece:JWL-00-NOPE00"]')`, open `/feed?view=saved`:
   "No longer available" is shown; clicking Remove empties the list.
8. A shared URL without location: `/search?sort=nearest&km=5` shows tiles (count > 0).

Expected: every line PASS. A FAIL is debugged (superpowers:systematic-debugging), fixed, and the script re-run.

- [ ] **Step 3: Screenshots**

With part 2's `shot.mjs` (CDP device emulation), capture at 390 px and 1366 px: `/` (hero must keep the headline
readable over the photo), `/search` (and at 390 px with the filter sheet open: open it via
`ev("[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Filters')).click()")` before
the capture), `/feed`. Read each image; check: no horizontal scroll (`scrollWidth` printed equals the width), the
hero text is legible, the sheet's "Show n results" button is visible, tiles align.

- [ ] **Step 4: Commit any fixes**

Each fix is committed separately with a message describing the visible change, and ledgered as a Task 7 ruling.
Stop the background servers at the end.
