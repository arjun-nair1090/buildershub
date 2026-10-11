# Marketplace, part 3: discovery

Date: 11 Oct 2026
Status: approved in discussion, awaiting spec review

## Context

Parts 1 and 2 added stores, pieces, designs and photos, and the pages buyers open for each. Part 3 lets buyers
find them: a home page built around browsing, search with filters, "Near me", and a photo feed with saves. It
covers items 1 (gold rate on the home page), 4, 7, 8 and 9 of the brief. Part 4 (brand and hardening) follows.

## Goals

- The home page shows the live gold rate, a photo hero with a search box, stores and the newest pieces.
- Buyers can search and filter pieces, designs and stores by category, purity, weight, price and distance.
- "Near me" sorts by distance without the buyer's location ever leaving their device; a city picker works
  for anyone who says no.
- A Pinterest-style photo feed with a save button; saves stay on the device, no account.

## Non-goals (this part)

- Server-side search, paging or a search index.
- Accounts, synced saves, sharing saves.
- Stock photos; the gold bar mark and favicon (part 4).
- A frontend test runner.

## Decisions

| Question | Decision |
|---|---|
| Hero photo | One of the store's own product photos (`rani-haar.jpg`), cropped and darkened behind the text |
| Where search lives | A separate page, `/search`; the home page links into it |
| What search returns | Three tabs: Pieces, Designs, Stores |
| Feed | Every photo of every published piece and design; saves are per piece or design |
| Where filtering happens | In the browser, over one catalogue response; location never sent to the server |
| Frontend tests | None added; scripted browser checks as in part 2 |

## API

Both endpoints are public and read-only. No database changes.

### `GET /api/public/catalog`

Everything buyers can browse, in one response. The browser searches, filters and sorts it.

```
{
  gold_rate: GoldRateOut | null,
  stores:  CatalogStore[],
  pieces:  CatalogPiece[],
  designs: CatalogDesign[]
}
```

- `CatalogStore`: `slug, name, area, city, latitude, longitude, cover: PhotoOut | null, piece_count,
  design_count`. Active stores only. `cover` is the store's first photo, else the cover of its newest visible
  piece, else null. Counts are of the pieces and designs listed in this response.
- `CatalogPiece`: everything in `PieceCard`, plus `store: slug`, `photos: PhotoOut[]` (all, in order),
  `created_at`. Published, active, not sold, store active. Newest first.
- `CatalogDesign`: everything in `DesignCard`, plus `store: slug`, `photos: PhotoOut[]`, `created_at`.
  Published, store active. Newest first.
- Prices come from `piece_price` with one `pricing_context`, exactly as on the piece page.
- `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, so Vercel's CDN serves it and
  browsers recheck.

Sold pieces are not in the catalogue: search and the feed show what can be bought. They stay on store pages
(part 2).

### `GET /api/public/gold-rate`

`GoldRateOut | null`: the same saved rate the piece page shows (`pricing_context(db).rate`), with its
`updated_at`. Cached like the catalogue. Used by the home page ticker, which polls it every 60 s while the
page is visible.

## Frontend

### Shared logic (`frontend/src/lib/discovery/`)

Pure functions, no React, so the pages stay thin:

- `distanceKm(a, b)`: haversine distance between two `{lat, lng}`, in km.
- `searchCatalog(catalog, query, filters, sort, here?)`: returns `{ pieces, designs, stores }`, each filtered
  and sorted, with `distanceKm` attached when `here` is known.
  - Text: case-insensitive match of every word against title, category, store name, area and city.
  - Category, purity: a piece matches its own value; a design matches if any of its purity options matches.
  - Weight (g): a piece matches when `net_weight` is within [min, max]; a design when its range overlaps.
  - Price (₹): a piece matches when the middle of its final range is within [min, max]; a design when its
    approx range overlaps.
  - Distance (km): needs `here`; an item matches when its store is within the limit.
  - City: the item's store is in that city.
  - Stores tab: only text, city and distance apply.
  - Sort: `newest` (default), `price_asc`, `price_desc` (pieces by final-range middle, designs by
    approx-range middle), `nearest` (only offered when `here` is known; without it, it falls back to
    `newest`). Stores sort by name for `newest` and the price sorts.
- `filtersFromParams(URLSearchParams)` and `filtersToParams(filters)`: the URL holds `q, tab, cat, purity,
  wmin, wmax, pmin, pmax, km, city, sort`. Unknown or malformed values are ignored. The location is never put
  in the URL.

### Hooks

- `useCatalog()`: loads `/api/public/catalog` once per page view, with loading, error and retry states.
- `useLocation()`: `{ here, status, request() }`, from a `LocationProvider` around the public layout, so a
  location granted on the home page is still known on `/search` for the rest of the visit. `request()` calls
  `navigator.geolocation.getCurrentPosition` with a 10 s timeout. `here` lives in React state only, never in
  storage or the URL. Status is `idle`, `asking`, `granted`, `denied` or `unavailable`.
- `useSaved()`: the saved ids (`piece:JWL-...`, `design:DSN...`) in `localStorage["jewlerify.saved"]`, shared
  across components and tabs (the `storage` event). If storage throws, saves are kept in memory for the
  session.
- The last city picked is remembered in `localStorage["jewlerify.city"]`, read in a try/catch.

### Header

Brand mark, then **Browse** (`/search`), **Feed** (`/feed`), **Verify jewellery** (`/verify`). On phones the
three links are compact text links, and "Jeweller login" moves to the footer; from `sm` up it stays in the
header.

### Home page (`/`)

Top to bottom:

1. **Hero.** `rani-haar.jpg` cropped to two files in `frontend/public/hero/`: a wide one for desktop
   (1600 x 900) and a tall one for phones (800 x 1000), both JPEG quality 80, chosen with `<picture>`. A basalt
   gradient (strong on the text side, clear on the photo side) keeps the white text at WCAG AA contrast.
   Headline "Find verified gold jewellery near you.", one line of supporting text, a search box (submits to
   `/search?q=...`), a **Near me** button (shows the location line described under Near me, asks for the
   location, then opens `/search?tab=stores&sort=nearest`; if refused, it opens `/search?tab=stores` with the city
   picker focused), and a "Verify a tag" link to `/verify`.
2. **Gold rate strip.** 24K and 22K per gram and "Updated {time ago}", from `/api/public/gold-rate`, polled every
   60 s while visible. With no rate ever fetched: "Gold rate unavailable right now". Never blank.
3. **Stores.** A row of store cards (cover, name, area and city, piece count), a horizontal scroller on phones.
4. **New pieces.** The 8 newest piece cards and "See all" (`/search`).
5. The existing "How it works", "What you can verify" and closing sections, unchanged.

Rows 3 and 4 come from `useCatalog()`. Each hides when empty; on error they show one message with Retry, and
the hero and search box keep working.

### Search page (`/search`)

- A search box, then tabs **Pieces (n) · Designs (n) · Stores (n)**, with counts after filtering.
- Filters: category chips, purity chips, weight min/max (g), price min/max (₹), distance (Any, 2, 5, 10,
  25 km; disabled with "Use Near me to filter by distance" until a location is known), city select (the
  catalogue's cities).
- **Near me** button and a sort select (Newest, Price low to high, Price high to low, Nearest when known).
- Desktop: filters in a left column. Phone: a "Filters (n)" button opens a bottom sheet with the same
  controls and a "Show {n} results" button.
- Results: `PieceTile`, `DesignTile` and a new `StoreTile`, each showing "2.3 km" when the location is known.
- Every filter change updates the URL (replace, not push, while typing; push on tab change), so back and
  shared links work.
- No results: "Nothing matches these filters" and a Clear filters button.

### Near me

- Tapping Near me (home or search) first shows one line beside the button: "Your location stays on this
  device and is only used to sort by distance." with **Continue**; Continue triggers the browser prompt.
- Granted: sort switches to Nearest, distances appear, the distance filter enables.
- Denied, unavailable or no answer in 10 s: the message "Location isn't available. Pick a city instead." and
  the city select is focused.
- The page works fully without location.

### Feed (`/feed`)

- One tile per photo of every catalogue piece and design, newest item first, photos in their own order.
- Masonry via CSS columns: 2 on phones, 3 from `sm`, 4 from `lg`. Photos keep their own aspect ratio
  (`width`/`height` reserve space).
- Tile: photo (thumb), a heart button (top-right, `aria-pressed`, label "Save {title}" / "Remove {title}
  from saved"), then the title and the price (pieces: final range; designs: "approx" range). Tile links to the
  piece or design page.
- 30 tiles at first, "Show more" adds 30.
- **All · Saved (n)** switch. Saved shows the saved pieces and designs as cards; one no longer in the
  catalogue shows "No longer available" with a Remove button.
- The same heart sits beside the title on the piece page and the design page.

## Error handling

- Catalogue load fails: home rows show "Couldn't load the catalogue" with Retry; `/search` and `/feed` show
  the same with Retry. The header, hero and search box keep working.
- Gold rate load fails on the home page: keep showing the last value received; with none, "Gold rate
  unavailable right now".
- Geolocation errors as above. Storage errors fall back to memory.

## Testing

Backend (pytest, SQLite):

- Catalogue: includes published, active pieces of active stores; excludes drafts, inactive, sold pieces and
  pieces of inactive stores; designs likewise; only active stores; counts and covers as specified; newest
  first; no admin-only fields or QR tokens; piece prices equal the piece page's; cache header.
- Gold rate endpoint: `null` with no rate; the saved rate when there is one.

Frontend:

- `npm run build`.
- Scripted checks in headless Chrome over the DevTools protocol (as in part 2): filters and sort change the
  results and the URL; Near me granted (emulated geolocation) sorts by distance and shows km; Near me denied
  shows the city picker; saving on the feed shows on the Saved tab and survives a reload; screenshots of home,
  search (with the filter sheet open) and feed at 390 px and desktop width, no horizontal scroll.

## Rollout

No migration. Push, deploy with `vercel deploy --prod`, then check the home page, search, Near me and the feed.
