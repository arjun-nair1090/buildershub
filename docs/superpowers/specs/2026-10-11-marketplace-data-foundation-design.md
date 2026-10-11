# Marketplace, part 1: data foundation

Date: 11 Oct 2026
Status: approved in discussion, awaiting spec review

## Context

Jewlerify today is one shop's verification site: admins register pieces, each gets a Jewellery ID and a QR
code, and buyers who scan it see the piece, a live gold rate and a live price range. The brief of 11 Oct 2026
turns it into a marketplace of local stores that buyers browse, verify and visit. The work is split into four
parts, built in this order, each with its own spec and plan:

1. **Data foundation** (this spec): stores, pieces with verification levels, discount pricing and several
   photos, designs, the admin screens for them.
2. Buyer pages: piece page (gallery, new price display, similar pieces), store page, design page.
3. Discovery: home page hero and ticker, search and filters, "Near me" and city picker, photo feed with saves.
4. Brand and hardening: gold bar mark and favicon, security headers, rate limiting, privacy page.

## Goals

- Model stores, pieces and designs as the brief's section 6 describes.
- Price pieces live from the gold rate with a discount on top, adding up exactly.
- Let the team enter all of it in admin.
- Keep every existing Jewellery ID, QR code and printed sticker working.

## Non-goals (this part)

- Buyer browsing, store and design pages, search, location, feed (parts 2 and 3).
- Map picker in admin; store-owner logins.
- Sample stores, stock photos or made-up pieces and designs. The data is the existing store, with placeholder
  details, and its 5 real pieces. Designs start empty.

## Data model

### `stores` (new)

| Column | Type | Notes |
|---|---|---|
| id | int PK | internal only |
| slug | str(80), unique | public key and future URL `/stores/{slug}`; generated from the name, editable |
| name | str(120) | required |
| address | text | required |
| area | str(80) | required, e.g. "Zaveri Bazaar" |
| city | str(80) | required, indexed |
| latitude, longitude | numeric(9,6) | required; -90..90 and -180..180 |
| phone, whatsapp | str(20), nullable | digits with optional leading +; call and WhatsApp buttons are hidden when empty |
| hours | str(200) | free text, e.g. "Mon-Sat 10:30 am - 8:30 pm" |
| status | str(20) | active / inactive |
| created_at, updated_at | timestamptz | |

A store with pieces or designs cannot be deleted, only deactivated. When a store is inactive, its pieces and
designs are treated as inactive everywhere buyers can see them.

### `designs` (new)

| Column | Type | Notes |
|---|---|---|
| id | int PK | internal only |
| public_id | str(12), unique | random, e.g. `DSN7K2QF9X`; not a Jewellery ID and never shown as one |
| store_id | FK stores | required |
| title | str(120) | required |
| description | text, nullable | |
| category | str(30) | same list as piece categories |
| purity_options | str(40) | comma-separated subset of 24K/22K/18K/14K, at least one |
| weight_min, weight_max | numeric(10,3) | grams, min <= max |
| price_min, price_max | numeric(12,2) | rupees, min <= max; always shown as "approx" |
| making_days_min, making_days_max | int | min <= max |
| is_published | bool | default false; needs at least one photo to be true |
| created_at, updated_at | timestamptz | |

Designs have no QR code, verification level, discount or live pricing.

### `photos` (new)

| Column | Type | Notes |
|---|---|---|
| id | int PK | internal only |
| public_id | str(32), unique | random hex; used in URLs |
| store_id / jewellery_id / design_id | FK, nullable | exactly one is set (check constraint); cascade on delete |
| position | int | 0-based order within its owner |
| alt_text | str(200) | blank on upload means "use the owner's title" |
| full | bytes | JPEG, longest side at most 1600 px |
| thumb | bytes | JPEG, longest side at most 600 px |
| width, height | int | of `full` |
| created_at | timestamptz | |

On upload (JPG or PNG, at most `MAX_UPLOAD_MB`): open with Pillow, apply the EXIF orientation, convert to RGB,
drop all metadata (so phone GPS data never reaches buyers), resize, and save both sizes as progressive JPEG,
quality 82. Pieces and designs take 1 to 6 photos, stores up to 6. A photo's bytes never change; replacing a
photo means a new row with a new `public_id`.

### `jewellery` (pieces) changes

| Column | Change |
|---|---|
| store_id | new FK stores, required |
| title | new str(120), required; `description` stays as the longer text |
| type | unchanged column, called "category" in the UI and API |
| verification_level | new str(20): `declared`, `hallmark`, `lab` |
| huid | new str(6), nullable; BIS HUID, 6 letters or digits, stored upper-case |
| stock_status | new str(20): `in_stock`, `reserved`, `sold`; default `in_stock` |
| is_published | new bool, default false |
| discount_type | new str(10), nullable: `percent` or `flat` |
| discount_value | new numeric(12,2), nullable; set exactly when `discount_type` is |
| discount_ends_on | new date, nullable; the discount applies up to the end of that day, Indian time |
| photo | removed; moved into `photos` |
| verification_status (property) | replaced by `verification_level` plus `status` |

The existing price columns (`gold_value`, `making_charges`, `other_component_value`, `tax`, `total_price`)
stay as the **registered price**: the fallback when no gold rate has ever been fetched.

Verification level rules, enforced on the server:

- `declared`: no requirement.
- `hallmark`: `huid` required.
- `lab`: certificate ID, issuing authority, certificate date and certificate file all required. The file
  must already be uploaded, so a piece is saved first and raised to `lab` once its file is attached.

Publishing rules: a piece needs at least one photo to be published. Deactivating (`status = inactive`) is
separate from publishing and keeps today's behaviour: the QR page says the record is no longer active.

What a buyer gets for a QR token:

| Piece state | Response |
|---|---|
| published, active, store active | the record |
| unpublished | 404 "not found" |
| inactive, or its store inactive | 410 "no longer active" |

### `store_settings` changes

`store_name` is removed; the name now lives on each store. `gst_percent` and `gold_rate_checked_at` stay.

## Migration (0005)

1. Create `stores`, `designs`, `photos`; add the new `jewellery` columns as nullable.
2. If any jewellery exists, create one store with placeholder details:
   - name: `store_settings.store_name` if set, else "Your Store Name"
   - address "Placeholder address, Zaveri Bazaar, Mumbai", area "Zaveri Bazaar", city "Mumbai"
   - latitude 18.951700, longitude 72.833100; phone and WhatsApp empty
   - hours "Placeholder: Mon-Sat 11 am - 8 pm"; slug from the name
3. For every piece:
   - `store_id` is the store from step 2.
   - `title` is `description` up to " in " if present, else `type` (e.g. "Nakshi kada in 22K gold" becomes
     "Nakshi kada").
   - `verification_level` is `lab` if `certificate_id` is set, otherwise `declared`.
   - `stock_status` is `in_stock`.
   - `is_published` is true for every existing piece, photo or not, so no printed QR code starts
     returning "not found". The photo rule applies from the next time a piece is published.
4. Move each `jewellery.photo` from `certificate_files` into `photos` at position 0, copying the bytes into both
   `full` and `thumb` (existing photos are already under 800 px), then delete the old file row.
5. Make `store_id`, `title`, `verification_level`, `stock_status`, `is_published` non-null; drop
   `jewellery.photo` and `store_settings.store_name`.

The downgrade reverses this: it restores the first photo and the store name, and drops the new columns and tables.

## Pricing

One server function, `piece_price(piece, rate, gst_percent, today)`, used everywhere a piece's price is
shown, so the QR page, and later the cards, feed and price filter, always agree.

Inputs: net weight, purity %, making % range (or the fixed registered making amount when the piece has no
range), other components, the store-wide GST %, and the discount.

| Line | Rule |
|---|---|
| Gold | net weight x (24K rate per gram x purity %), rounded to the rupee |
| Making | making % min and max of the gold line, each rounded; or the fixed amount |
| Other | `other_component_value`, rounded |
| GST | GST % of (gold + making + other), each end rounded |
| Original | gold + making + other + GST, per end |
| Discount | percent: original x p, each end rounded. Flat: the amount. Either is capped at 90% of that end's original |
| Final | original - discount, per end |

Because every line is rounded before it is added, the lines add up exactly to the final price at both ends.

- No discount: discount is null and final equals original.
- The discount is ignored when `discount_ends_on` is before today in Asia/Kolkata, or when the piece is sold.
- Validation on save:
  - A percent discount must be 1 to 90.
  - A flat discount must be above 0 and below the registered `total_price`.
  - `discount_ends_on` may be in the past; the discount is then simply not shown.
- No rate ever fetched: the registered price columns become the original price (making as a single amount),
  the discount applies the same way, and `as_of` is the piece's `updated_at`.
- `as_of` is otherwise the gold rate's `fetched_at`.

Price shape returned to the frontend:

```
price: {
  basis: "live" | "registered",
  as_of: datetime,
  rate_per_gram: decimal | null,      # for the piece's purity
  gold, other, gst_percent,
  making_min, making_max, making_percent_min, making_percent_max,
  tax_min, tax_max,
  original_min, original_max,
  discount: null | { type, value, label, amount_min, amount_max, ends_on },   # label "10% off" / "₹5,000 off"
  final_min, final_max
}
```

This replaces `live_price` in the verify response. Designs keep their entered `price_min`/`price_max`.

The gold rate feed is unchanged: metals.dev IBJA rate, cached for `GOLD_RATE_TTL_MINUTES` (480 on the free
plan), last saved rate on failure.

## API

All admin routes require an admin token, as today.

- **Stores:** `GET/POST /api/stores`; `GET/PUT/DELETE /api/stores/{slug}`;
  `POST /api/stores/{slug}/activate|deactivate`. DELETE returns 409 when the store has pieces or designs.
- **Designs:** `GET/POST /api/designs` (list filters: `store`, `published`); `GET/PUT/DELETE /api/designs/{public_id}`.
- **Pieces:** existing `/api/jewellery` routes. The list gains `store`, `published` and `stock` filters, and the
  body gains the new fields. The single-photo routes are removed.
- **Photos:**
  - `POST /api/{stores|jewellery|designs}/{key}/photos` uploads one photo (multipart file and alt_text);
    the 7th photo returns 422.
  - `PUT /api/{stores|jewellery|designs}/{key}/photos/order` takes the full list of photo public ids.
  - `PUT /api/photos/{public_id}` updates alt text.
  - `DELETE /api/photos/{public_id}` removes a photo. Removing the last photo of a published piece or
    design returns 422.
- **Photo bytes:** `GET /api/photos/{public_id}/{full|thumb}` is public when the owner is visible to buyers
  and admin-only otherwise. It sends `Cache-Control: public, max-age=31536000, immutable` (plus `s-maxage` so
  Vercel's CDN caches it) and `private, no-store` for admin-only photos. A cached copy of a public photo
  can outlive unpublishing its owner; that's acceptable because the URL is random and is only published
  while the owner is visible.
- **Verify:** `GET /api/verify/{token}`:
  - adds `title`, `verification_level`, `huid`, `stock_status`;
  - `store` becomes `{ slug, name, area, city }` and replaces `store_name`;
  - `photos` becomes `[{ public_id, alt_text, width, height }]` and replaces `photo_version`;
  - `price` replaces `live_price`.

  `/api/verify/{token}/photo` is removed.
- **Settings:** `store_name` removed from `GET/PUT /api/settings`.

## Admin UI

- Navigation: Dashboard, Stores, Pieces, Designs, Team, Store settings.
- **Stores:**
  - The list shows name, area, city, piece count, design count and status.
  - The form has all store fields, plus a "Check on map" link that opens
    `https://www.google.com/maps?q={lat},{lng}`, and the photo manager.
  - The list offers activate, deactivate and delete.
- **Pieces:** today's form, extended:
  - Step 1 adds a store select and title. Photos move to the photo manager on the piece's detail page; on
    "Add", the photo manager appears after the first save.
  - A verification level select reveals the HUID field, or the certificate fields, as needed.
  - Stock status and a published switch. Publishing without a photo shows the server's message.
  - A discount block: none / percent / flat, value, and end date. Beside it, a live preview of original,
    discount and final at today's rate, using the same numbers the server returns.
  - The list gains store, published and stock filters.
- **Designs:** list (title, store, price range, published) and a form with the design fields, plus the photo
  manager.
- **Photo manager** (one component, used by stores, pieces and designs):
  - thumbnails in order, with up/down buttons and an alt text field each;
  - delete with a confirmation dialog;
  - an upload button, hidden at 6 photos.
- **Store settings:** the name field goes; GST % and the gold rate panel stay.
- **Dashboard:** counts of stores, pieces (published, in stock), designs.

## Buyer QR page during part 1

Only the changes the new data forces; the rest waits for part 2:

- The badge reflects `verification_level`: "Declared by store", "Hallmark linked" (with the HUID), or "Lab
  verified" (with the certificate).
- The store tab shows `store.name`.
- The first photo is shown, linked to its full size.
- The price block shows the struck-through original, the discount label, the final price as the largest number,
  the itemised breakdown including the discount line, "Price as of {as_of}", and "Final price confirmed at the
  store".
- A sold piece shows a "Sold" label.

## Seed

`seed.py` creates the placeholder store, the admin, and the 5 pieces (titled, `declared`, published, in stock,
no discount) with their photos through the same photo processing as uploads. It stays idempotent and drops the
old demo-removal step, which has already run in production.

## Error handling

All the rules above are validated by Pydantic or the router and return 422 with a field-level message (or
409 for deleting a store in use). The admin forms show these beside the field. Photo processing errors
(unreadable image, wrong type, too large) return 422 with a plain message.

## Testing

- **Pricing:**
  - percent and flat discounts
  - the 90% cap
  - an expired discount
  - a sold piece
  - the registered fallback
  - the lines adding up exactly at both ends, across a range of weights and rates
- **Rules:** verification-level requirements; publish without a photo; deleting the last photo of a
  published piece; deleting a store in use; 404/410 for unpublished, inactive, and inactive-store pieces.
- **Photos:** resize limits, EXIF and GPS removed, the 6-photo cap, reorder, public vs admin-only access and
  cache headers.
- **Migration:** run up, down and up on SQLite and against local Postgres, with a seeded database whose pieces
  have photos.
- **Frontend:** `tsc -b` and `npm run build`; screenshots of each admin screen and the QR page at 390 px and
  desktop width.

## Rollout

Same as the last release: run migration 0005 and the seed against production, deploy with
`vercel deploy --prod`, then check the QR pages. The production store keeps placeholder details until the team
edits them in admin.
