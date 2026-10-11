<div align="center">

<a href="https://jewlerify.vercel.app"><img src="docs/readme/banner.svg" width="100%" alt="Jewlerify: every jewel, verified, near you. A gold bar, the Jewlerify wordmark and a phone scanning a QR tag into a verified badge."></a>

<br>

[![Live](https://img.shields.io/badge/live-jewlerify.vercel.app-D4AE6A?style=for-the-badge&labelColor=1F2427)](https://jewlerify.vercel.app)
[![React](https://img.shields.io/badge/React_19-1F2427?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-1F2427?style=for-the-badge&logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind_v4-1F2427?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-1F2427?style=for-the-badge&logo=fastapi&logoColor=05998B)](https://fastapi.tiangolo.com)
[![Postgres](https://img.shields.io/badge/PostgreSQL-1F2427?style=for-the-badge&logo=postgresql&logoColor=6BA6E0)](https://www.postgresql.org)
[![Vercel](https://img.shields.io/badge/Vercel-1F2427?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

**A marketplace of local jewellery stores where every piece carries a QR tag.**<br>
Scan it to see the piece's purity, weight and verification level, priced live from today's gold rate. Then find the store and walk in.

[**Open the live site →**](https://jewlerify.vercel.app) &nbsp;·&nbsp; [How it works](#how-it-works) &nbsp;·&nbsp; [Run it locally](#3-setup--local-development) &nbsp;·&nbsp; [API](#7-api-summary)

<br>

<img src="docs/readme/tour.gif" width="92%" alt="A tour of the site: the home page with its photo hero and live gold rate, the stores and newest pieces, a search for chain, a piece page with its live price breakdown, the store page with its map, and saving a piece in the photo feed.">

</div>

<br>

## How it works

<img src="docs/readme/how-it-works.svg" width="100%" alt="Four steps: Register (the store lists a piece with photos, purity, weight and a QR tag), Scan (any phone camera opens it, no app needed), Verify (declared, hallmark or lab level, priced at today's gold rate), Visit (near me, call, WhatsApp or directions).">

## What's inside

<table>
<tr>
<td width="50%" valign="top">

### 🔍 For buyers
- **Scan or type a tag.** Every piece has its own page and QR code, with a swipeable photo gallery.
- **Honest verification.** *Declared by store*, *Hallmark linked* (with the BIS HUID) or *Lab verified* (with the certificate). The badge always matches what's on record.
- **Live pricing.** Gold value from the IBJA rate, making charges, tax and any discount, itemised and adding up to the rupee.
- **Browse and search.** Filter by category, purity, weight, price and distance; Pieces, Designs and Stores tabs.
- **Near me.** Sorts by distance with the location kept on your phone. Say no and pick a city instead.
- **Photo feed.** Pinterest-style, with a heart to save pieces on your device. No account.

</td>
<td width="50%" valign="top">

### 🏪 For stores
- **Admin for stores, pieces and made-to-order designs**, with up to 6 photos each (resized, metadata stripped).
- **Discounts** as a percentage or a flat amount, with an end date. The original price is struck through and the final price is shown largest.
- **Stock and publishing.** In stock, reserved or sold; nothing is public until it has a photo.
- **QR codes** that keep working when the piece changes.

### 🛡️ Built to be trusted
- Security headers and a strict content security policy on every page.
- Rate limits on login and verify, shared across serverless instances, storing only hashed IPs.
- A plain-language [privacy page](https://jewlerify.vercel.app/privacy): buyers' locations and saves never leave the phone.

</td>
</tr>
</table>

## Under the hood

```mermaid
flowchart LR
    buyer(["📱 Buyer"]) -->|scan · browse| cdn["Vercel edge"]
    store(["🏪 Store team"]) -->|admin| cdn
    cdn --> spa["React 19 SPA<br/>Vite · Tailwind v4"]
    cdn -->|/api| api["FastAPI<br/>(serverless Python)"]
    api --> db[("PostgreSQL<br/>Neon")]
    api -->|gold rate, cached| ibja["metals.dev<br/>IBJA rate"]
```

> Jewlerify shows what is registered against a QR code. It does **not** physically test gold purity, detect counterfeits, or independently validate certification.

**Stack:** React 19 + TypeScript + Tailwind CSS v4 (shadcn-style components on Radix, Lucide icons) · FastAPI · PostgreSQL 16 · SQLAlchemy 2 + Alembic · JWT auth · `qrcode` + Pillow for QR codes and photos.

---

## 1. Project structure

```text
buildershub/
├── docker-compose.yml          # db (+ backend + frontend for the full stack)
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, validation-error format
│   │   ├── config.py           # settings from .env
│   │   ├── database.py         # engine, session, Base
│   │   ├── models.py           # users, jewellery tables
│   │   ├── schemas.py          # request/response models + validation
│   │   ├── security.py         # bcrypt hashing, JWT
│   │   ├── deps.py             # current-user / admin guards
│   │   ├── constants.py        # jewellery types, purity grades
│   │   ├── routers/            # auth.py, jewellery.py, verify.py
│   │   └── services/           # qr.py, files.py (upload checks), identifiers.py
│   ├── alembic/versions/       # database migrations
│   ├── tests/                  # pytest API tests
│   ├── seed.py                 # admin user + the store's 5 pieces
│   ├── seed_photos/            # product photos loaded by seed.py
│   └── uploads/                # certificate documents (git-ignored)
└── frontend/
    └── src/
        ├── components/         # ui/, layout/, jewellery/, verify/, landing/
        ├── pages/              # LandingPage, VerifyPage, VerifyLookupPage, admin/*
        ├── services/           # api.ts (fetch wrapper), auth, jewellery, verify
        ├── hooks/              # useAuth, useJewellery, useQrImage, useDebounce
        ├── types/              # shared TypeScript types
        └── utils/              # formatting (₹, g, dates), downloads
```

## 2. Setup — quick start with Docker (everything)

Requires Docker Desktop.

```bash
docker compose up --build
```

Open **http://localhost:8080**. Migrations and the seed run automatically on first start.

## 3. Setup — local development

Requires Python 3.11+, Node 20+ and Docker (for PostgreSQL), or your own PostgreSQL 14+.

```bash
# 1. Database
docker compose up -d db                 # PostgreSQL on localhost:5433

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate                  # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env                  # macOS/Linux: cp .env.example .env
#   then set JWT_SECRET in .env (see section 4)
alembic upgrade head                    # create tables
python seed.py                          # admin user + the store's jewellery
uvicorn app.main:app --reload --port 8010

# 3. Frontend (new terminal)
cd frontend
npm install
copy .env.example .env.local            # macOS/Linux: cp .env.example .env.local
npm run dev                             # http://localhost:5173
```

The Vite dev server forwards `/api/*` to the backend, so the frontend and API share one origin.

> Ports 5433 (database) and 8010 (API) are used instead of the usual 5432/8000 to avoid clashing with other local projects. Change `DB_PORT` / `DATABASE_URL` / `VITE_API_PROXY_TARGET` if you prefer others.

## 4. Environment variables

**`backend/.env`**

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL for PostgreSQL | `postgresql+psycopg://jewellery:jewellery@localhost:5433/jewellery` |
| `JWT_SECRET` | **Required.** Signing key for login tokens. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session length without "Keep me signed in" | `480` |
| `REMEMBER_ME_EXPIRE_DAYS` | Session length with "Keep me signed in" | `14` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | `http://localhost:5173` |
| `PUBLIC_BASE_URL` | Public frontend URL. QR codes encode `{PUBLIC_BASE_URL}/verify/{token}` | `http://localhost:5173` |
| `MAX_UPLOAD_MB` | Certificate and photo upload size limit (kept under Vercel's 4.5 MB request cap) | `4` |
| `METALS_DEV_API_KEY` | [metals.dev](https://metals.dev) key for the live gold rate (free plan, IBJA rate). Takes priority over `GOLDAPI_KEY`. With neither set, buyers see the registered prices | — |
| `GOLDAPI_KEY` | [GoldAPI.io](https://www.goldapi.io) key for the live gold rate (international spot rate) | — |
| `GOLD_RATE_TTL_MINUTES` | How long a fetched rate is reused. Every page view reads the cached rate, so API calls stay at about one per interval. The default keeps within the free plans' 100 requests a month | `480` |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin account created by `seed.py` | see below |

**`frontend/.env.local`**

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_PROXY_TARGET` | Where the dev server forwards `/api` | `http://localhost:8010` |
| `VITE_API_BASE_URL` | Optional: call the API directly instead of via the proxy | — |

## 5. Database

Created by the Alembic migrations in `alembic/versions/`:

- **`users`**: `id, name, email, password_hash, role, status, token_version, created_at`
- **`stores`**: `id, slug, name, address, area, city, latitude, longitude, phone, whatsapp, hours, status, created_at, updated_at`
- **`jewellery`** (pieces): `id, jewellery_id, verification_token, store_id, title, type, description, colour, design_details, purity, gross_weight, net_weight, verification_level, huid, certificate_id, issuing_authority, certificate_date, certificate_document, gold_value, making_charges, other_component_value, tax, total_price, making_percent_min, making_percent_max, discount_type, discount_value, discount_ends_on, stock_status, is_published, status, created_at, updated_at`
- **`designs`** (made to order): `id, public_id, store_id, title, description, category, purity_options, weight_min, weight_max, price_min, price_max, making_days_min, making_days_max, is_published, created_at, updated_at`
- **`photos`**: one row per photo of a store, piece or design (`public_id, store_id | piece_id | design_id, position, alt_text, image, thumbnail, width, height`). Uploads are resized to 1600 px and 600 px JPEGs with their metadata (including GPS) removed.
- **`certificate_files`**: uploaded certificate documents (`name, data`)
- **`store_settings`**: one row with the marketplace-wide `gst_percent`
- **`gold_rates`**: each successful market fetch (`inr_per_gram_24k, source, fetched_at`); the latest is the current rate

Money is stored as `NUMERIC(12,2)` and weights as `NUMERIC(10,3)`, so there's no floating-point rounding. Check constraints enforce `net_weight <= gross_weight` and a valid `status`.

```bash
alembic upgrade head      # apply migrations
alembic downgrade base    # drop everything
python seed.py            # idempotent: adds the placeholder store and any missing pieces
```

## 6. Demo login

| | |
|---|---|
| URL | http://localhost:5173/admin/login (Docker: http://localhost:8080/admin/login) |
| Email | `admin@jewelverify.demo` |
| Password | `Admin@12345` |

Change `SEED_ADMIN_PASSWORD` before seeding anything other than a local demo.

### Verification links

| Jewellery | Link |
|---|---|
| JWL-26-B2TPBR, Nakshi kada, 25.94 g | `/verify/UWPVS7T9QZR9` |
| JWL-26-C7HWNK, Hollow chain, 8.85 g | `/verify/PHY5GUC34N8U` |
| JWL-26-RF3D4S, Rani haar, 10.76 g | `/verify/2HGN47ZX72WF` |
| JWL-26-ABKUCR, Casting ring, 4.88 g | `/verify/T3CMCQCGXRFB` |
| JWL-26-EMQXKD, Jaguar bracelet, 6.14 g | `/verify/YDYXKM846872` |
| unknown | `/verify/ABCDEFGHJKMN` (not found) |

All five are 22K and start as *Declared by store*, on a placeholder store in Mumbai. Edit the store (name, address, map location, phone, hours) under **Stores**, and raise a piece to Hallmark linked or Lab verified from its Edit page.

Buyers can also type the printed Jewellery ID at `/verify`.

## 7. API summary

Interactive docs: http://localhost:8010/docs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{email, password, remember}` → JWT + user |
| POST | `/api/auth/logout` | admin | End session (client discards token) |
| GET | `/api/auth/me` | admin | Current user |
| GET | `/api/jewellery` | admin | List with `search`, `type`, `purity`, `status`, `sort`, `order`, `page`, `page_size` |
| POST | `/api/jewellery` | admin | Register a piece. Total is calculated unless `total_price` is given |
| GET | `/api/jewellery/stats` | admin | Pieces (total / published / in stock / inactive), stores and designs |
| POST | `/api/jewellery/price-preview` | admin | The price buyers would see for the given figures and discount |
| GET | `/api/jewellery/{jewellery_id}` | admin | One record, with its current price |
| PUT | `/api/jewellery/{jewellery_id}` | admin | Update (QR stays the same) |
| DELETE | `/api/jewellery/{jewellery_id}` | admin | Deactivate (soft delete) |
| POST | `/api/jewellery/{jewellery_id}/activate` | admin | Reactivate |
| GET | `/api/jewellery/{jewellery_id}/qr` | admin | Print-resolution QR PNG (~1200 px, 300 dpi) |
| POST / GET / DELETE | `/api/jewellery/{jewellery_id}/certificate` | admin | Upload / download / remove certificate (PDF, JPG, PNG, ≤ 4 MB) |
| GET / POST | `/api/stores` | admin | List (with piece and design counts) / add a store |
| GET / PUT / DELETE | `/api/stores/{slug}` | admin | One store / update / delete (`409` while it has pieces or designs) |
| POST | `/api/stores/{slug}/activate`, `/deactivate` | admin | Show or hide the store and everything it sells |
| GET / POST | `/api/designs` | admin | List with `store`, `published` / add a made-to-order design |
| GET / PUT / DELETE | `/api/designs/{public_id}` | admin | One design / update / delete |
| POST | `/api/{stores\|jewellery\|designs}/{key}/photos` | admin | Upload a photo (JPG, PNG, ≤ 4 MB; up to 6) |
| PUT | `/api/{stores\|jewellery\|designs}/{key}/photos/order` | admin | Reorder photos; the first is the cover |
| PUT / DELETE | `/api/photos/{public_id}` | admin | Edit alt text / delete a photo |
| GET | `/api/photos/{public_id}/full`, `/thumb` | public* | The image. *Public while its owner is visible to buyers, admin-only otherwise |
| GET / PUT | `/api/settings` | admin | GST % and the current gold rate |
| GET | `/api/verify/{token}` | public | Buyer view: store, photos, verification level, live gold rate, price and up to 8 similar pieces from the same store. `404` not found or unpublished, `410` inactive (no details returned) |
| GET | `/api/public/stores/{slug}` | public | Store page: details, photos, its pieces (sold last) and designs as cards. `404` unknown, `410` inactive |
| GET | `/api/public/designs/{public_id}` | public | Design page. `404` unknown or unpublished, `410` store inactive |
| GET | `/api/public/catalog` | public | Everything buyers can browse (stores, pieces in stock or reserved, designs, gold rate); the browser filters it. Cached 60 s at the CDN |
| GET | `/api/public/gold-rate` | public | The saved gold rate per karat with its time, or `null` before the first fetch |

Validation errors return `422` as `{"detail": "...", "fields": {"field": "message"}}`.

## 8. How QR verification works

1. **Register.** On save, the backend generates a Jewellery ID (`JWL-26-A8F72K`) and a separate random 12-character verification token (~59 bits). Both use an alphabet without look-alike characters (0/O, 1/I/L). The internal database id is never exposed.
2. **Generate.** `GET /api/jewellery/{id}/qr` encodes `{PUBLIC_BASE_URL}/verify/{token}` with error correction level Q, rendered in brand basalt at ~1200 px with the Jewellery ID printed underneath.
3. **Scan.** Any phone camera opens the URL in the browser.
4. **Verify.** The page calls `GET /api/verify/{token}`:
   - **Lab verified** → certificate ID, issuer and date shown; a certificate file is on record
   - **Hallmark linked** → the BIS HUID is shown
   - **Declared by store** → the store's own details, with no certificate or HUID vouched for
   - **Deactivated, or the store is inactive** → *Record inactive*, with no jewellery details shown
   - **Unknown or unpublished** → *Verification record not found*

   The public response contains only buyer-facing fields: no internal ids, token, document path or admin data.

**Scanning from a real phone during development:** set `PUBLIC_BASE_URL=http://<your-computer's-LAN-IP>:5173` in `backend/.env` and restart the backend. Find the IP with `ipconfig`. Add the same origin to `CORS_ORIGINS` only if you use `VITE_API_BASE_URL`. The phone must be on the same Wi-Fi, and Windows may ask you to allow Node through the firewall. QR codes are generated on request, so re-download them after changing the URL.

### Live pricing

With `METALS_DEV_API_KEY` or `GOLDAPI_KEY` set, the buyer page shows a live gold rate ticker and prices the piece at today's rate:

- **Gold value** = net gold weight × (market rate per gram of pure gold × purity, e.g. 91.6% for 22K)
- **Making charges** = the item's making range in % of that gold value (set per item; without a range, the fixed amount)
- **Tax** = the GST % on gold value + making charges + other components
- **Original price** = the sum, shown as a range when making charges are a range
- **Discount** = a percent or flat amount off both ends (at most 90%), until its end date; never on sold pieces
- **Final price** = original − discount. Every line is rounded to the rupee first, so the lines add up exactly.

With metals.dev the rate is the IBJA (India Bullion and Jewellers Association) benchmark, which includes import duty and tracks Indian shop rates; IBJA publishes it twice on working days. GoldAPI.io gives the international spot price in INR, which leaves out import duty and so runs below a typical Indian retail board rate. An open page re-checks every minute; the server calls the API at most once per `GOLD_RATE_TTL_MINUTES`, and after a failed call it keeps using the last known rate and waits 5 minutes before trying again. If no rate has ever been fetched, the registered amounts are used instead, so a price always shows.

## 9. Testing

```bash
# Backend API tests (isolated in-memory SQLite, does not touch your data)
cd backend
pytest -q

# Frontend type check and production build
cd frontend
npm run build
```

`pytest` covers login/logout/validation, protected routes, CRUD, automatic and manual totals, search/filter/sort/pagination, stats, public verification (valid, unknown, inactive, no private fields leaked), QR PNG resolution, and certificate upload validation (rejects wrong types and spoofed contents).

### Manual checklist

1. Sign in at `/admin/login` (try a wrong password first).
2. **Add Jewellery**: fill the form and attach a PDF. Watch the total add up, then save.
3. On the success screen, **Download QR**, then **View verification page**.
4. Scan the downloaded PNG with a phone (see the LAN note above).
5. Edit the record, then deactivate it and reload the verification page. It should say *Record inactive*.
6. Search the list by Jewellery ID, certificate ID and type, and filter by status.
7. Check `/verify/ABCDEFGHJKMN` for the not-found state.
8. Resize to phone width: the verification page, dashboard and list all switch to mobile layouts.

## Security notes

- Passwords hashed with bcrypt. Login uses constant-ish timing for unknown emails.
- JWT bearer tokens. "Keep me signed in" stores the token in `localStorage`, otherwise in `sessionStorage`.
- All `/api/jewellery/*` routes require an active admin. The public endpoint exposes buyer fields only.
- Uploads are checked by extension, MIME type **and** file signature, size-limited, stored under random names outside the web root, and served only to admins.
- Secrets come from environment variables. `.env` is git-ignored.
- **Rate limits:** login allows 5 failed attempts per email and 20 per IP address in 15 minutes; the verify
  endpoint allows 60 lookups per IP per minute. Counts live in the `rate_limits` table (shared by every server
  instance), keyed by an HMAC of the email or IP so neither is stored, and are deleted after a day (on login, and on
  about one verify lookup in a hundred). Login attempts are counted before the password is checked, so parallel
  guesses can't slip through; a correct login gives its count back. If the table is unavailable, requests are
  allowed. The client address comes from `X-Real-IP`, which Vercel and the bundled nginx set.
- **Headers:** API responses send `nosniff`, `no-referrer`, `X-Frame-Options: DENY` and a CSP that allows
  nothing; pages get a CSP, HSTS and a permissions policy from `vercel.json`.
