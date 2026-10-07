# Jewellery Transparency & Verification System

A jeweller registers a piece of jewellery. The system gives it a unique Jewellery ID, a digital record and a QR code. A buyer scans the QR code with their phone camera and sees the registered details, the certificate reference and an itemised price breakdown. No app is needed.

> The system verifies that a QR code corresponds to a registered digital record. It does **not** physically test gold purity, detect counterfeits, or independently validate certification.

**Stack:** React 19 + TypeScript + Tailwind CSS v4 (shadcn-style components on Radix, Lucide icons) · FastAPI · PostgreSQL 16 · SQLAlchemy 2 + Alembic · JWT auth · `qrcode` + Pillow for QR generation.

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
│   ├── seed.py                 # admin user + 10 demo records
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

Open **http://localhost:8080**. Migrations and demo data run automatically on first start.

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
python seed.py                          # admin user + demo jewellery
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
| `MAX_UPLOAD_MB` | Certificate upload size limit | `5` |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin account created by `seed.py` | see below |

**`frontend/.env.local`**

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_PROXY_TARGET` | Where the dev server forwards `/api` | `http://localhost:8010` |
| `VITE_API_BASE_URL` | Optional: call the API directly instead of via the proxy | — |

## 5. Database

Two tables, created by the Alembic migration `0001_initial`:

- **`users`**: `id, name, email, password_hash, role, status, created_at`
- **`jewellery`**: `id, jewellery_id, type, description, purity, gross_weight, net_weight, certificate_id, issuing_authority, certificate_date, certificate_document, gold_value, making_charges, other_component_value, tax, total_price, verification_token, status, created_at, updated_at`

Money is stored as `NUMERIC(12,2)` and weights as `NUMERIC(10,3)`, so there's no floating-point rounding. Check constraints enforce `net_weight <= gross_weight` and a valid `status`.

```bash
alembic upgrade head      # apply migrations
alembic downgrade base    # drop everything
python seed.py            # idempotent: only seeds an empty jewellery table
```

## 6. Demo login

| | |
|---|---|
| URL | http://localhost:5173/admin/login (Docker: http://localhost:8080/admin/login) |
| Email | `admin@jewelverify.demo` |
| Password | `Admin@12345` |

Change `SEED_ADMIN_PASSWORD` before seeding anything other than a local demo.

### Demo verification links

| Jewellery | Link | Result |
|---|---|---|
| JWL-26-A8F72K, 22K diamond ring | `/verify/K7Q2M9XRT4HP` | Verified record |
| JWL-26-R5V2HJ, 14K band (no certificate) | `/verify/P4KD9XN3QW6M` | Registered record |
| JWL-26-H6Q9YT, retired choker | `/verify/N7WC4M8ZK3RX` | Record inactive |
| unknown | `/verify/ABCDEFGHJKMN` | Verification record not found |

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
| GET | `/api/jewellery/stats` | admin | Total / active / verified / inactive counts |
| GET | `/api/jewellery/{jewellery_id}` | admin | One record |
| PUT | `/api/jewellery/{jewellery_id}` | admin | Update (QR stays the same) |
| DELETE | `/api/jewellery/{jewellery_id}` | admin | Deactivate (soft delete) |
| POST | `/api/jewellery/{jewellery_id}/activate` | admin | Reactivate |
| GET | `/api/jewellery/{jewellery_id}/qr` | admin | Print-resolution QR PNG (~1200 px, 300 dpi) |
| POST / GET / DELETE | `/api/jewellery/{jewellery_id}/certificate` | admin | Upload / download / remove certificate (PDF, JPG, PNG, ≤ 5 MB) |
| GET | `/api/verify/{token}` | public | Buyer view. `404` not found, `410` inactive (no details returned) |

Validation errors return `422` as `{"detail": "...", "fields": {"field": "message"}}`.

## 8. How QR verification works

1. **Register.** On save, the backend generates a Jewellery ID (`JWL-26-A8F72K`) and a separate random 12-character verification token (~59 bits). Both use an alphabet without look-alike characters (0/O, 1/I/L). The internal database id is never exposed.
2. **Generate.** `GET /api/jewellery/{id}/qr` encodes `{PUBLIC_BASE_URL}/verify/{token}` with error correction level Q, rendered in brand emerald at ~1200 px with the Jewellery ID printed underneath.
3. **Scan.** Any phone camera opens the URL in the browser.
4. **Verify.** The page calls `GET /api/verify/{token}`:
   - **Active with a certificate reference** → *Verified record*
   - **Active without a certificate reference** → *Registered record* (honest about the missing certificate)
   - **Deactivated** → *Record inactive*, with no jewellery details shown
   - **Unknown** → *Verification record not found*

   The public response contains only buyer-facing fields: no internal ids, token, document path or admin data.

**Scanning from a real phone during development:** set `PUBLIC_BASE_URL=http://<your-computer's-LAN-IP>:5173` in `backend/.env` and restart the backend. Find the IP with `ipconfig`. Add the same origin to `CORS_ORIGINS` only if you use `VITE_API_BASE_URL`. The phone must be on the same Wi-Fi, and Windows may ask you to allow Node through the firewall. QR codes are generated on request, so re-download them after changing the URL.

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
