# Marketplace, part 2: buyer pages

Date: 11 Oct 2026
Status: approved in discussion, awaiting spec review

## Context

Part 1 (data foundation, `2026-10-11-marketplace-data-foundation-design.md`) added stores, pieces with
verification levels and discounts, designs and photos, and updated the QR page for the new data. Part 2 builds
the pages buyers use to look at that data: the piece page's gallery and similar pieces, the store page and the
design page. It covers items 2, 3, 10 and 11 of the brief. Item 1 (gold rate on the QR page) and item 6 (price
display) were done in part 1.

Parts still to come: 3, discovery (home hero and ticker, search and filters, "Near me", photo feed); 4, brand
and hardening.

## Goals

- A swipeable gallery of all of a piece's photos on its page.
- A "Similar pieces" row on the piece page.
- A public store page with contact buttons, a map, its pieces and its designs.
- A public design page that reads clearly as made to order and approximate.

## Non-goals (this part)

- Search, filters, location, home page changes, the feed (part 3).
- New data, admin screens or migrations. Sample stores, pieces or designs.
- Contact buttons on piece and design pages: they link to the store page instead.
- A full-screen photo viewer.

## Addresses

| Page | URL | Notes |
|---|---|---|
| Piece | `/verify/{token}` | unchanged, so printed QR codes keep working; also accepts the Jewellery ID |
| Store | `/stores/{slug}` | new |
| Design | `/designs/{public_id}` | new |

Lists link to pieces as `/verify/{jewellery_id}`, so a piece's QR token never appears in a list. Buyers reach
the store page from the store name on a piece or design page, and pieces and designs from the store page.

## API

All endpoints here are public (no login) and read-only.

### Card shapes

Used everywhere a list of pieces or designs appears, now and in part 3.

`PieceCard`:

```
{ jewellery_id, title, type, purity, net_weight, stock_status,
  cover: PhotoOut | null,
  price: { final_min, final_max, original_min, original_max, discount_label | null } }
```

The price comes from `piece_price` with the same rate context as the piece page, so a card and the page it
opens always show the same numbers. `original_*` equal `final_*` when there is no discount.

`DesignCard`:

```
{ public_id, title, category, purity_options, weight_min, weight_max, price_min, price_max,
  cover: PhotoOut | null }
```

`cover` is the photo at position 0.

### `GET /api/public/stores/{slug}`

Returns `PublicStore`:

```
{ slug, name, address, area, city, latitude, longitude, phone, whatsapp, hours,
  photos: PhotoOut[],
  pieces: PieceCard[],
  designs: DesignCard[] }
```

- `pieces`: the store's pieces that are published and active. In stock and reserved come first, then sold;
  within each group, newest first.
- `designs`: the store's published designs, newest first.
- Unknown slug: 404 "Store not found". Inactive store: 410 "Store no longer listed".

### `GET /api/public/designs/{public_id}`

Returns `PublicDesign`:

```
{ public_id, store: StoreRef, title, description, category, purity_options,
  weight_min, weight_max, price_min, price_max, making_days_min, making_days_max,
  photos: PhotoOut[] }
```

- Unknown or unpublished: 404 "Design not found". Store inactive: 410 "Design no longer listed".

### `GET /api/verify/{token}` gains `similar: PieceCard[]`

Up to 8 pieces:

1. Candidates: the same store, published, active, not sold, not this piece.
2. Score each one: same category +4, same purity +2, final price within ±30% of this piece's +1. Prices are
   compared at the midpoint of each final range: `|mid(candidate) - mid(this)| <= 0.30 x mid(this)`.
3. Keep candidates scoring at least 1. Order by score (highest first), then by distance from this piece's
   midpoint (closest first), then by Jewellery ID so the order is stable.
4. Return the first 8. An empty list is normal.

### Unchanged

The database, admin endpoints and photo access rules. Photos of active stores, and of published pieces and
designs whose store is active, are already public.

## Pages

### Shared components

**Gallery** (piece, store and design pages)

- A horizontal CSS scroll-snap strip, no library. Swipe on touch screens; previous and next buttons and the
  arrow keys on desktop; one dot per photo showing the current one.
- Each slide is an `<img>` with `srcset` of the thumb (600 px) and full (1600 px) URLs and `sizes` matching the
  slide width, the photo's `alt`, and `width`/`height` to reserve space. The first slide loads eagerly, the
  rest lazily.
- The current position is announced to screen readers ("Photo 2 of 5").
- With one photo: no buttons and no dots. With none: the gallery isn't rendered.

**Piece card**

- Cover photo (thumb, 3:4, cropped), title, purity and net weight.
- The final price as a range (or one figure when min equals max). With a discount, also the struck-through
  original and a chip with the discount label.
- A "Reserved" or "Sold" label when not in stock.
- The whole card is one link to `/verify/{jewellery_id}`.

**Design card**

- Cover photo, title, purity options, "approx ₹x–y" and a "Made to order" label.
- Never a verification badge or a Jewellery ID.
- The whole card is one link to `/designs/{public_id}`.

### Piece page (`/verify/{token}`)

- The single photo beside the purity stamp is replaced by the gallery at the top of the details section; the
  stamp stays.
- The store tab in the banner becomes a link to `/stores/{slug}`.
- A "Similar pieces" row of piece cards after the record: a horizontal scroller on phones, a grid on desktop.
  Not rendered when `similar` is empty.
- Everything else is unchanged.

### Store page (`/stores/{slug}`)

- Header: store name, then area and city; the gallery below when the store has photos.
- Visit block:
  - address and hours;
  - **Call**: `tel:{phone}`, shown when phone is set;
  - **WhatsApp**: `https://wa.me/{whatsapp without +}`, shown when WhatsApp is set;
  - **Directions**: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`, always shown;
  - a map: an OpenStreetMap embed iframe
    (`https://www.openstreetmap.org/export/embed.html?bbox=...&layer=mapnik&marker={lat},{lng}`) with
    `loading="lazy"` and a title for screen readers, plus the "© OpenStreetMap contributors" credit.
- "Pieces": a grid of piece cards, in the order the API returns (sold ones last, labelled). Hidden when there are none.
- "Made to order": a grid of design cards, with the line "Approximate prices. Final price agreed with the
  store." Hidden when there are none.
- When the store has neither, the line "No pieces listed yet."

### Design page (`/designs/{public_id}`)

- Gallery, title, category and a "Made to order" label.
- Details: approximate weight range ("approx 30–45 g"), purity options, approximate price range ("approx
  ₹3,50,000–5,20,000"), making time ("14–21 days"), and the description when set.
- The note "Approximate price. Final price agreed with the store."
- The store's name, area and city, linking to the store page.
- No verification badge, Jewellery ID, gold rate or price breakdown.

### Common to all three

- The browser tab title names the piece, store or design.
- Layout works at 390 px and at desktop width, in the existing public layout and visual style.
- Loading shows a skeleton.

## Error handling

- 404: a "not found" page ("Store not found", "Design not found"), in the style of the existing
  record-unavailable page, with a link home.
- 410: "This store is no longer listed" or "This design is no longer available".
- Network or server error: the message and a Retry button.
- These are shown instead of any partial content.

## Testing

Backend (pytest, SQLite):

- Store page: contents and order (in stock and reserved before sold, newest first), drafts and inactive pieces
  excluded, unpublished designs excluded, 404 unknown slug, 410 inactive store, no admin-only fields in the
  response.
- Design page: published design returned; 404 unknown and unpublished; 410 when the store is inactive.
- Similar pieces: ranking by score then price distance; pieces scoring 0 excluded; sold, unpublished, inactive,
  other-store pieces and the current piece excluded; at most 8; empty list.
- Card prices equal the piece page's `price` for the same piece, including with a discount.

Frontend:

- `tsc -b` and `npm run build` pass.
- Screenshots of the piece, store and design pages at 390 px and desktop width against the local stack,
  including a piece with several photos and a store with no phone.

## Rollout

No migration. Deploy with `vercel deploy --prod` and check the store page, a design page (once one is
published) and a QR page.
