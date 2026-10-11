# Marketplace Brand and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the diamond with a gold bar mark, add security headers, rate-limit login and verify, and add a
privacy page.

**Architecture:** A FastAPI middleware adds protective headers to API responses and `vercel.json` adds the page
headers (CSP included). Rate limits are fixed-window counters in a new `rate_limits` table, keyed by a scope and
an HMAC of the email or IP, updated with one atomic insert-or-update per request so all serverless instances share
them. The brand mark is an SVG ingot reused for the wordmark, favicon and a lucide-style icon.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, pytest on SQLite; React 19, TypeScript, Vite 8, Tailwind v4,
lucide-react (`createLucideIcon`); Vercel `vercel.json` headers.

**Spec:** `docs/superpowers/specs/2026-10-11-marketplace-brand-hardening-design.md`

## Global Constraints

- No new dependencies. One migration: `0006_rate_limits`, down_revision `0005_marketplace_foundation`.
- Limits: `login-email` 5 failures / 15 min; `login-ip` 20 failures / 15 min; `verify-ip` 60 lookups / 1 min.
- Keys are `{scope}:{first 32 hex of HMAC-SHA256(JWT_SECRET, value.strip().lower())}`; no raw email or IP stored.
- Rows older than a day are purged (on every login attempt).
- A rate-limit storage failure allows the request (logged), never blocks it.
- 429 messages: login "Too many attempts. Try again in {n} minutes." (n rounded up; "1 minute" when n is 1),
  verify "Too many lookups. Try again in a minute."; both send `Retry-After`.
- API headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (not on `/docs`, `/redoc`, `/openapi.json`).
- Page headers exactly as the spec's table (CSP, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options,
  HSTS).
- Privacy placeholders: `OPERATOR = "[Your company name]"`, `CONTACT_EMAIL = "[contact email]"`.
- No diamond graphics remain; no import of lucide's `Gem`.
- Commit messages: plain sentences ("Add ..."), no AI attribution or co-author trailers.
- Backend tests: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`. Frontend gate:
  `npm --prefix frontend run build` plus Task 6's CSP check and screenshots.

## Review Focus

1. The live CSP blocking something the app needs (Google Fonts, photos, the OSM map, admin `blob:` previews,
   Vite's built assets): pages must render exactly as before (Task 6 loads every page type under the real headers).
2. Two requests racing on a brand-new key (first hit from an IP on two instances at once): both must count, no
   500 (Task 2 uses one `INSERT ... ON CONFLICT DO UPDATE`, never select-then-insert).
3. A buyer's piece page polling verify every 60 s, with several tabs open, must stay well under 60/min (60/min per
   IP; Task 3's test shows a 61st lookup is the first refused).
4. An email typed in a different case or with spaces counts against the same login limit (Task 2 test
   `test_only_hashes_are_stored` checks case; `_key` strips and lower-cases).
5. The rate-limit table unavailable (e.g. migration not yet run in production): login and verify still work
   (Task 2 test `test_a_counter_failure_lets_the_request_through`).

---

### Task 1: Security headers on API responses

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_security.py`

**Interfaces:**
- Produces: middleware `security_headers` in `app/main.py`; constant `API_HEADERS`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_security.py`:

```python
def test_api_responses_carry_security_headers(client):
    res = client.get("/api/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_errors_carry_them_too_and_docs_keep_their_scripts(client):
    assert client.get("/api/verify/NOPE0000").headers["x-content-type-options"] == "nosniff"
    docs = client.get("/docs")
    assert docs.status_code == 200 and "content-security-policy" not in docs.headers
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_security.py -q -p no:warnings`
Expected: 2 failed (`KeyError: 'x-content-type-options'`).

- [ ] **Step 3: Add the middleware**

In `backend/app/main.py`, after the `app.add_middleware(CORSMiddleware, ...)` call, add:

```python
API_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    # JSON and images never need scripts, styles or frames.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")  # the interactive docs load scripts


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in API_HEADERS.items():
        if name == "Content-Security-Policy" and request.url.path.startswith(DOCS_PATHS):
            continue
        response.headers.setdefault(name, value)
    return response
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_security.py -q -p no:warnings`
Expected: `2 passed`

- [ ] **Step 5: Whole suite and commit**

Run: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`
Expected: all pass (166 before, 168 now).

```bash
git add backend/app/main.py backend/tests/test_security.py
git commit -m "Add security headers to API responses"
```

---

### Task 2: Rate-limit counters

**Files:**
- Modify: `backend/app/models.py` (add `RateLimit`)
- Create: `backend/alembic/versions/0006_rate_limits.py`
- Create: `backend/app/services/rate_limit.py`
- Create: `backend/tests/test_rate_limit.py`
- Modify: `backend/tests/test_migrations.py` (one test)

**Interfaces:**
- Produces: model `RateLimit(key, window_start, count)`; `Verdict(allowed: bool, retry_after: int)`;
  `hit(db, scope, value, limit, window, now=None) -> Verdict`; `peek(db, scope, value, limit, window, now=None) -> Verdict`;
  `clear(db, scope, value) -> None`; `purge(db, now=None) -> None`; `client_ip(request) -> str`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_rate_limit.py`:

```python
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models import RateLimit
from app.services import rate_limit

T0 = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
MIN = timedelta(minutes=1)


def at(seconds: int) -> datetime:
    return T0 + timedelta(seconds=seconds)


def test_hit_counts_blocks_and_starts_over(db):
    for i in range(3):
        assert rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(i)).allowed
    blocked = rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(20))
    assert not blocked.allowed and blocked.retry_after == 40
    assert rate_limit.hit(db, "t", "5.6.7.8", 3, MIN, at(20)).allowed  # another IP has its own count
    assert rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(60)).allowed  # the window ended: start over


def test_peek_does_not_count(db):
    for _ in range(2):
        rate_limit.hit(db, "t", "x", 2, MIN, T0)
    waiting = rate_limit.peek(db, "t", "x", 2, MIN, at(30))
    assert not waiting.allowed and waiting.retry_after == 30
    assert rate_limit.peek(db, "t", "x", 2, MIN, at(60)).allowed
    assert rate_limit.peek(db, "t", "never-seen", 2, MIN, T0).allowed
    assert db.scalar(select(RateLimit.count)) == 2


def test_only_hashes_are_stored(db):
    rate_limit.hit(db, "login-email", "Admin@Test.Demo", 5, MIN, T0)
    rate_limit.hit(db, "login-ip", "203.0.113.7", 5, MIN, T0)
    keys = db.scalars(select(RateLimit.key)).all()
    assert len(keys) == 2
    assert all("admin" not in k.lower() and "203.0" not in k for k in keys)
    rate_limit.hit(db, "login-email", " admin@test.demo ", 5, MIN, T0)  # any case, stray spaces: same counter
    assert db.scalar(select(RateLimit.count).where(RateLimit.key.like("login-email:%"))) == 2


def test_clear_and_purge(db):
    rate_limit.hit(db, "t", "x", 1, MIN, T0)
    rate_limit.hit(db, "t", "y", 1, MIN, T0)
    rate_limit.clear(db, "t", "x")
    assert db.scalar(select(func.count()).select_from(RateLimit)) == 1
    rate_limit.purge(db, T0 + timedelta(hours=25))
    assert db.scalar(select(func.count()).select_from(RateLimit)) == 0


def test_a_counter_failure_lets_the_request_through(db, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db, "execute", broken)
    monkeypatch.setattr(db, "get", broken)
    assert rate_limit.hit(db, "t", "x", 1, MIN, T0).allowed
    assert rate_limit.peek(db, "t", "x", 1, MIN, T0).allowed
    rate_limit.clear(db, "t", "x")  # no exception
    rate_limit.purge(db, T0)


def test_client_ip_prefers_the_forwarded_address():
    class Req:
        def __init__(self, headers, host):
            self.headers = headers
            self.client = type("C", (), {"host": host})() if host else None

    assert rate_limit.client_ip(Req({"x-forwarded-for": "203.0.113.7, 10.0.0.1"}, "10.0.0.2")) == "203.0.113.7"
    assert rate_limit.client_ip(Req({}, "10.0.0.2")) == "10.0.0.2"
    assert rate_limit.client_ip(Req({}, None)) == "unknown"
```

Append to `backend/tests/test_migrations.py`:

```python
def test_rate_limits_table_up_down_up(migrate):
    from sqlalchemy import inspect

    cfg, engine = migrate
    command.upgrade(cfg, "head")
    assert "rate_limits" in inspect(engine).get_table_names()
    command.downgrade(cfg, "0005_marketplace_foundation")
    assert "rate_limits" not in inspect(engine).get_table_names()
    command.upgrade(cfg, "head")
    assert "rate_limits" in inspect(engine).get_table_names()
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_rate_limit.py tests/test_migrations.py -q -p no:warnings`
Expected: collection error / failures (`ImportError: cannot import name 'RateLimit'`).

- [ ] **Step 3: Model and migration**

Append to `backend/app/models.py`:

```python
class RateLimit(Base):
    """A fixed-window counter shared by every server instance. `key` is a scope plus a keyed hash of the email
    or IP address, never the raw value."""

    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column(Integer, default=0)
```

Create `backend/alembic/versions/0006_rate_limits.py`:

```python
"""Add rate_limits for login and verify throttling

Revision ID: 0006_rate_limits
Revises: 0005_marketplace_foundation
Create Date: 2026-10-11
"""
import sqlalchemy as sa
from alembic import op

revision = "0006_rate_limits"
down_revision = "0005_marketplace_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("rate_limits")
```

- [ ] **Step 4: The service**

Create `backend/app/services/rate_limit.py`:

```python
"""Fixed-window rate limits kept in the database, so every serverless instance shares the same counts.
Emails and IP addresses are stored only as keyed hashes. If the table can't be reached, requests are allowed:
a broken counter must never lock people out."""
import hashlib
import hmac
import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import RateLimit

log = logging.getLogger(__name__)
KEEP = timedelta(days=1)


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    retry_after: int  # seconds until the window ends; 0 when allowed


ALLOW = Verdict(True, 0)


def _key(scope: str, value: str) -> str:
    secret = get_settings().jwt_secret.encode()
    digest = hmac.new(secret, value.strip().lower().encode(), hashlib.sha256).hexdigest()
    return f"{scope}:{digest[:32]}"


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite hands back naive UTC


def _verdict(count: int, start: datetime, limit: int, window: timedelta, now: datetime) -> Verdict:
    if count <= limit:
        return ALLOW
    return Verdict(False, max(1, math.ceil((_aware(start) + window - now).total_seconds())))


def hit(db: Session, scope: str, value: str, limit: int, window: timedelta, now: datetime | None = None) -> Verdict:
    """Counts one request and says whether it is within the limit. One atomic statement, so two instances
    counting the same key at once both land."""
    now = now or datetime.now(timezone.utc)
    try:
        insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
        ended = RateLimit.window_start <= now - window
        stmt = (
            insert(RateLimit)
            .values(key=_key(scope, value), window_start=now, count=1)
            .on_conflict_do_update(
                index_elements=[RateLimit.key],
                set_={
                    "count": case((ended, 1), else_=RateLimit.count + 1),
                    "window_start": case((ended, now), else_=RateLimit.window_start),
                },
            )
            .returning(RateLimit.count, RateLimit.window_start)
        )
        count, start = db.execute(stmt).one()
        db.commit()
    except Exception:
        db.rollback()
        log.exception("Rate limit counter unavailable; allowing the request")
        return ALLOW
    return _verdict(count, start, limit, window, now)


def peek(db: Session, scope: str, value: str, limit: int, window: timedelta, now: datetime | None = None) -> Verdict:
    """Would one more counted request be allowed? Doesn't count."""
    now = now or datetime.now(timezone.utc)
    try:
        row = db.get(RateLimit, _key(scope, value))
    except Exception:
        db.rollback()
        log.exception("Rate limit counter unavailable; allowing the request")
        return ALLOW
    if row is None or _aware(row.window_start) + window <= now:
        return ALLOW
    return _verdict(row.count + 1, row.window_start, limit, window, now)


def clear(db: Session, scope: str, value: str) -> None:
    try:
        db.execute(delete(RateLimit).where(RateLimit.key == _key(scope, value)))
        db.commit()
    except Exception:
        db.rollback()
        log.exception("Rate limit counter unavailable; nothing cleared")


def purge(db: Session, now: datetime | None = None) -> None:
    """Forget counters whose window started more than a day ago."""
    now = now or datetime.now(timezone.utc)
    try:
        db.execute(delete(RateLimit).where(RateLimit.window_start < now - KEEP))
        db.commit()
    except Exception:
        db.rollback()
        log.exception("Rate limit counter unavailable; nothing purged")


def client_ip(request) -> str:
    """Vercel puts the caller's address first in X-Forwarded-For; locally it's the socket's peer."""
    first = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_rate_limit.py tests/test_migrations.py -q -p no:warnings`
Expected: all pass (6 rate-limit tests + 4 migration tests).

- [ ] **Step 6: Whole suite and commit**

Run: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`
Expected: all pass (175).

```bash
git add backend/app/models.py backend/alembic/versions/0006_rate_limits.py backend/app/services/rate_limit.py backend/tests/test_rate_limit.py backend/tests/test_migrations.py
git commit -m "Add database-backed rate limit counters"
```

---

### Task 3: Limit login and verify

**Files:**
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/routers/verify.py`
- Modify: `backend/tests/test_rate_limit.py` (route tests)
- Modify: `README.md` (security notes)

**Interfaces:**
- Consumes: `hit`, `peek`, `clear`, `purge`, `client_ip`, `Verdict` from `app/services/rate_limit.py` (Task 2).
- Produces: 429 responses with `Retry-After` on `POST /api/auth/login` and `GET /api/verify/{token}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_rate_limit.py`:

```python
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD


def login(client, email=ADMIN_EMAIL, password="wrong-password", ip="198.51.100.1"):
    return client.post("/api/auth/login", json={"email": email, "password": password}, headers={"X-Forwarded-For": ip})


def test_login_locks_an_email_after_five_failures(client):
    for _ in range(5):
        assert login(client).status_code == 401
    res = login(client, password=ADMIN_PASSWORD)  # even the right password waits
    assert res.status_code == 429
    assert res.json()["detail"] == "Too many attempts. Try again in 15 minutes."
    assert 0 < int(res.headers["retry-after"]) <= 900
    assert login(client, email=ADMIN_EMAIL.upper(), password=ADMIN_PASSWORD).status_code == 429  # same email


def test_login_limits_failures_per_ip_across_emails(client):
    for i in range(20):
        assert login(client, email=f"user{i}@test.demo").status_code == 401
    assert login(client, password=ADMIN_PASSWORD).status_code == 429
    assert login(client, password=ADMIN_PASSWORD, ip="198.51.100.2").status_code == 200


def test_a_successful_login_clears_the_email_count(client):
    for _ in range(4):
        login(client)
    assert login(client, password=ADMIN_PASSWORD).status_code == 200
    for _ in range(4):
        assert login(client).status_code == 401  # would be failures 5 to 8 without the reset
    assert login(client, password=ADMIN_PASSWORD).status_code == 200


def test_verify_limits_lookups_per_ip(client, publish):
    token = publish()["verification_token"]
    for _ in range(60):
        assert client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.9"}).status_code == 200
    res = client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.9"})
    assert res.status_code == 429
    assert res.json()["detail"] == "Too many lookups. Try again in a minute."
    assert 1 <= int(res.headers["retry-after"]) <= 60
    assert client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.10"}).status_code == 200
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_rate_limit.py -q -p no:warnings -k "login or verify"`
Expected: 4 failed (401/200 where 429 was expected).

- [ ] **Step 3: Limit login**

In `backend/app/routers/auth.py`:
- change the first import to `from fastapi import APIRouter, Depends, HTTPException, Request, Response, status`;
- add `import math` and `from datetime import timedelta` at the top, and
  `from app.services import rate_limit` with the other app imports;
- above `@router.post("/login", ...)`, add:

```python
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_LIMITS = (("login-email", 5), ("login-ip", 20))  # failed attempts per window


def too_many_attempts(verdict: rate_limit.Verdict) -> HTTPException:
    minutes = math.ceil(verdict.retry_after / 60)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many attempts. Try again in {minutes} minute{'' if minutes == 1 else 's'}.",
        headers={"Retry-After": str(verdict.retry_after)},
    )
```

- replace the `login` function with:

```python
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    ip = rate_limit.client_ip(request)
    keys = {"login-email": body.email, "login-ip": ip}
    rate_limit.purge(db)
    for scope, limit in LOGIN_LIMITS:
        verdict = rate_limit.peek(db, scope, keys[scope], limit, LOGIN_WINDOW)
        if not verdict.allowed:
            raise too_many_attempts(verdict)

    user = db.scalar(select(User).where(User.email == body.email))
    if not verify_password(body.password, user.password_hash if user else None) or user.status != "active":
        for scope, limit in LOGIN_LIMITS:
            rate_limit.hit(db, scope, keys[scope], limit, LOGIN_WINDOW)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    rate_limit.clear(db, "login-email", body.email)
    token, expires_in = create_access_token(user.id, user.token_version, remember=body.remember)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))
```

- [ ] **Step 4: Limit verify**

In `backend/app/routers/verify.py`:
- change the first import to `from fastapi import APIRouter, Depends, HTTPException, Path, Request, status`;
- add `from datetime import timedelta` at the top and `from app.services import rate_limit` with the app imports;
- below `Code = Path(...)`, add `VERIFY_WINDOW = timedelta(minutes=1)` and `VERIFY_LIMIT = 60  # lookups per IP per minute; an open piece page polls once a minute`;
- add `429: {"description": "Too many lookups"}` to the route's `responses`;
- change the signature to `def verify(request: Request, token: str = Code, db: Session = Depends(get_db)) -> PublicVerification:`
  and make its first lines:

```python
    """Public endpoint opened from the QR code."""
    verdict = rate_limit.hit(db, "verify-ip", rate_limit.client_ip(request), VERIFY_LIMIT, VERIFY_WINDOW)
    if not verdict.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many lookups. Try again in a minute.",
            headers={"Retry-After": str(verdict.retry_after)},
        )
    item = visible_piece(db, token)
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_rate_limit.py -q -p no:warnings`
Expected: `10 passed`

- [ ] **Step 6: Document**

In `README.md`'s "Security notes" section, add these bullets at the end of its list:

```markdown
- **Rate limits:** login allows 5 failed attempts per email and 20 per IP address in 15 minutes; the verify
  endpoint allows 60 lookups per IP per minute. Counts live in the `rate_limits` table (shared by every server
  instance), keyed by an HMAC of the email or IP so neither is stored, and are deleted after a day. If the table
  is unavailable, requests are allowed.
- **Headers:** API responses send `nosniff`, `no-referrer`, `X-Frame-Options: DENY` and a CSP that allows
  nothing; pages get a CSP, HSTS and a permissions policy from `vercel.json`.
```

- [ ] **Step 7: Whole suite and commit**

Run: `cd backend && .venv/Scripts/python -m pytest -q -p no:warnings`
Expected: all pass (179).

```bash
git add backend/app/routers/auth.py backend/app/routers/verify.py backend/tests/test_rate_limit.py README.md
git commit -m "Rate-limit login and verify"
```

---

### Task 4: Gold bar mark

**Files:**
- Modify: `frontend/src/components/layout/BrandMark.tsx` (replace `Gem` with `GoldBar`)
- Create: `frontend/src/components/layout/GoldBarIcon.ts`
- Modify: `frontend/src/components/layout/AdminLayout.tsx`, `frontend/src/pages/admin/DashboardPage.tsx`,
  `frontend/src/pages/admin/JewelleryListPage.tsx`, `frontend/src/pages/admin/LoginPage.tsx`
- Modify: `frontend/public/favicon.svg`
- Create: `frontend/public/apple-touch-icon.png`
- Modify: `frontend/index.html`

**Interfaces:**
- Produces: `GoldBar({ className })` (filled SVG, viewBox `0 0 24 20`); `GoldBarIcon` (a `LucideIcon`).

- [ ] **Step 1: The filled mark**

In `frontend/src/components/layout/BrandMark.tsx`, replace the `GEM` constant and the whole `Gem` function with:

```tsx
const FRONT = "M1 18.5h22l-4-9.5H5Z";
const TOP = "M5 9l2.4-6h9.2L19 9Z";

/** A gold bar, seen from the front: the "gold" in Jewlerify, and the dot on its i. */
export function GoldBar({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 20" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DDA6" />
          <stop offset="0.5" stopColor="#D4AE6A" />
          <stop offset="1" stopColor="#9C7637" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF0D2" />
          <stop offset="1" stopColor="#E6C88F" />
        </linearGradient>
      </defs>
      <path d={TOP} fill={`url(#${id}-top)`} />
      <path d={FRONT} fill={`url(#${id}-front)`} />
      {/* The bright edge where the top meets the front. */}
      <path d="M5.2 9h13.6" stroke="#fff" strokeOpacity=".55" strokeWidth=".7" strokeLinecap="round" />
    </svg>
  );
}
```

In the same file, in `BrandMark`, replace `<Gem className=...` with `<GoldBar className=...` (same classes), and
change the comment above `BrandMark` to `/** Wordmark: "Jewlerify" with a gold bar in place of the dot on the i. */`.

- [ ] **Step 2: The line icon**

Create `frontend/src/components/layout/GoldBarIcon.ts`:

```ts
import { createLucideIcon } from "lucide-react";

/** The gold bar as a line icon, matching lucide's 24 px grid and stroke, for nav items and empty states. */
export const GoldBarIcon = createLucideIcon("gold-bar", [
  ["path", { d: "M2.5 19.5h19l-3.4-8.5H5.9Z", key: "front" }],
  ["path", { d: "M5.9 11 8 5.5h8l2.1 5.5", key: "top" }],
]);
```

- [ ] **Step 3: Replace every gem**

- `AdminLayout.tsx`: remove `Gem` from the lucide import, add `import { GoldBarIcon } from "./GoldBarIcon";`, and
  use `icon: GoldBarIcon` for the "Pieces" nav item.
- `DashboardPage.tsx` and `JewelleryListPage.tsx`: remove `Gem` from the lucide import, add
  `import { GoldBarIcon } from "@/components/layout/GoldBarIcon";`, and change `icon={Gem}` to
  `icon={GoldBarIcon}`.
- `LoginPage.tsx`: change the import to `import { BrandMark, GoldBar } from "@/components/layout/BrandMark";` and
  the watermark to `<GoldBar className="pointer-events-none absolute -bottom-16 -right-20 w-96 rotate-12 opacity-[0.07]" />`.

Then run: `grep -rn "Gem\b" frontend/src`
Expected: no output.

- [ ] **Step 4: Favicon and home-screen icon**

Replace `frontend/public/favicon.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3DDA6"/><stop offset=".5" stop-color="#D4AE6A"/><stop offset="1" stop-color="#9C7637"/></linearGradient><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF0D2"/><stop offset="1" stop-color="#E6C88F"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="#1F2427"/><g transform="translate(4 6)"><path d="M5 9l2.4-6h9.2L19 9Z" fill="url(#t)"/><path d="M1 18.5h22l-4-9.5H5Z" fill="url(#f)"/><path d="M5.2 9h13.6" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/></g></svg>
```

Render the 180 px PNG (square, no rounded corners: iOS rounds it itself) with headless Chrome. Write
`icon.html` in the session scratchpad:

```html
<!doctype html><html><body style="margin:0;background:#1F2427">
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 32 32"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3DDA6"/><stop offset=".5" stop-color="#D4AE6A"/><stop offset="1" stop-color="#9C7637"/></linearGradient><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF0D2"/><stop offset="1" stop-color="#E6C88F"/></linearGradient></defs><rect width="32" height="32" fill="#1F2427"/><g transform="translate(4 6)"><path d="M5 9l2.4-6h9.2L19 9Z" fill="url(#t)"/><path d="M1 18.5h22l-4-9.5H5Z" fill="url(#f)"/><path d="M5.2 9h13.6" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/></g></svg>
</body></html>
```

Run: `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=600,600 --screenshot=<scratchpad>/icon-full.png file:///<scratchpad>/icon.html`
then crop to 180 x 180:
`backend/.venv/Scripts/python -c "from PIL import Image; Image.open(r'<scratchpad>/icon-full.png').crop((0,0,180,180)).convert('RGB').save('frontend/public/apple-touch-icon.png', optimize=True)"`
Expected: `frontend/public/apple-touch-icon.png` exists, 180 x 180, the ingot centred on basalt (open it to check).

In `frontend/index.html`, after the favicon `<link>`, add
`<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`.

- [ ] **Step 5: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0.

```bash
git add frontend/src/components/layout frontend/src/pages/admin/DashboardPage.tsx frontend/src/pages/admin/JewelleryListPage.tsx frontend/src/pages/admin/LoginPage.tsx frontend/public/favicon.svg frontend/public/apple-touch-icon.png frontend/index.html
git commit -m "Replace the diamond with a gold bar in the logo, favicon and icons"
```

---

### Task 5: Page headers and the privacy page

**Files:**
- Modify: `vercel.json` (top-level `headers`)
- Create: `frontend/src/config/site.ts`
- Create: `frontend/src/pages/PrivacyPage.tsx`
- Modify: `frontend/src/App.tsx` (route `privacy`)
- Modify: `frontend/src/components/layout/PublicLayout.tsx` (footer link)

**Interfaces:**
- Produces: route `/privacy`; `OPERATOR`, `CONTACT_EMAIL` from `@/config/site`.

- [ ] **Step 1: Page headers**

In `vercel.json`, add a top-level key after `"rewrites"`:

```json
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src https://www.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" }
      ]
    }
  ]
```

Check it parses: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 2: Site config and page**

Create `frontend/src/config/site.ts`:

```ts
/** Who runs the site, shown on the privacy page. Placeholders until launch: replace both. */
export const OPERATOR = "[Your company name]";
export const CONTACT_EMAIL = "[contact email]";
```

Create `frontend/src/pages/PrivacyPage.tsx`:

```tsx
import { useEffect, type ReactNode } from "react";
import { CONTACT_EMAIL, OPERATOR } from "@/config/site";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="font-display text-[24px] leading-tight text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy";
  }, []);
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[38px] leading-tight text-ink sm:text-[46px]">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated 11 Oct 2026</p>
      <p className="mt-6 text-[17px] leading-relaxed text-ink">
        Jewlerify lets you browse jewellery from local stores and check how each piece is verified. You don't need an
        account, and we don't collect personal information from buyers.
      </p>

      <Section title="Who runs Jewlerify">
        <p>Jewlerify is run by {OPERATOR}. You can reach us at {CONTACT_EMAIL}.</p>
      </Section>
      <Section title="What buyers share">
        <p>Nothing personal. There are no buyer accounts, no sign-up and no forms that ask for your name, number or email.</p>
      </Section>
      <Section title="Your location">
        <p>
          We only ask for your location when you tap Near me. It is used on your device to sort stores and pieces by
          distance. It is never sent to our servers, put in a link or saved.
        </p>
      </Section>
      <Section title="Saved pieces">
        <p>
          When you tap the heart, the piece or design is saved in this browser's local storage on your device. We
          never receive it. Clearing your browser's site data removes it.
        </p>
      </Section>
      <Section title="Protecting the site">
        <p>
          To stop people guessing codes or passwords, we count requests to the verify page and the team login. We keep
          your IP address, and the email typed into the login form, only as a one-way scrambled code, never as they
          are, and delete the counts within a day.
        </p>
      </Section>
      <Section title="Hosting">
        <p>
          The site runs on Vercel, which keeps standard request logs (such as the address a request came from and the
          page requested) to operate and secure its service.
        </p>
      </Section>
      <Section title="Store team accounts">
        <p>
          People who manage stores on Jewlerify sign in with a name, an email address and a password. Passwords are
          stored only as a secure hash.
        </p>
      </Section>
      <Section title="Photos">
        <p>Every uploaded photo is re-encoded, which removes hidden details such as where the photo was taken.</p>
      </Section>
      <Section title="Cookies">
        <p>
          We don't use tracking or advertising cookies. The team login is kept in the browser's storage on the team
          member's device.
        </p>
      </Section>
      <Section title="Questions">
        <p>Write to {CONTACT_EMAIL} and we'll answer.</p>
      </Section>
    </article>
  );
}
```

- [ ] **Step 3: Route and footer link**

In `frontend/src/App.tsx`, add `import { PrivacyPage } from "@/pages/PrivacyPage";` and, after the `feed` route,
`<Route path="privacy" element={<PrivacyPage />} />`.

In `frontend/src/components/layout/PublicLayout.tsx`, in `PublicFooter`, add a Privacy link as the first child
of the `<div className="flex shrink-0 items-center gap-4">`:

```tsx
          <Link to="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            Privacy
          </Link>
```

- [ ] **Step 4: Build and commit**

Run: `npm --prefix frontend run build`
Expected: exits 0.

```bash
git add vercel.json frontend/src/config frontend/src/pages/PrivacyPage.tsx frontend/src/App.tsx frontend/src/components/layout/PublicLayout.tsx
git commit -m "Add page security headers and the privacy page"
```

---

### Task 6: CSP check and screenshots

**Files:**
- No product files unless a check fails; any fix is its own commit with a ledgered ruling.
- Scratch (not committed): `csp-check.mjs` in the session scratchpad.

**Interfaces:**
- Consumes: `vercel.json` headers (Task 5); the built frontend.

- [ ] **Step 1: Run the built site locally**

`docker compose up -d db`; in `backend`, `.venv/Scripts/alembic upgrade head` (applies 0006 to the local
database) then `.venv/Scripts/python -m uvicorn app.main:app --port 8010` (background); then
`npm --prefix frontend run build` and `npm --prefix frontend run preview -- --port 4180 --strictPort`
(background). `vite preview` serves the built files and proxies `/api` like the dev server; the dev server is not
used because it injects inline scripts that the production CSP would rightly block.

- [ ] **Step 2: The CSP check**

Write `csp-check.mjs` in the scratchpad, using the same DevTools-protocol launcher as part 3's
`discovery-browser.mjs`, which:

1. Reads `vercel.json` and builds the header list from `headers[0].headers`.
2. Calls `Fetch.enable({ patterns: [{ urlPattern: "http://localhost:4180/*", requestStage: "Response" }] })`, and
   on each `Fetch.requestPaused` calls `Fetch.continueResponse({ requestId, responseHeaders: [...original, ...vercel] })`
   so every response carries the production headers.
3. Before each navigation, `Page.addScriptToEvaluateOnNewDocument` installs
   `window.__csp = []; document.addEventListener("securitypolicyviolation", e => window.__csp.push(e.violatedDirective + " " + e.blockedURI));`
4. Visits `/`, `/search`, `/feed`, `/stores/your-store-name`, `/verify/UWPVS7T9QZR9`, `/privacy`, `/admin/login`, then
   signs in with the local seed admin (from `backend/seed.py`) by filling the form and submitting, and visits
   `/admin` and `/admin/jewellery`. On each page, after 4 s, prints `PASS`/`FAIL` with `window.__csp`, and checks
   `document.fonts.check('16px "Gilda Display"')`, that every `img` has `naturalWidth > 0`, and on the store page
   that the map `iframe` exists.

Run: `node <scratchpad>/csp-check.mjs`
Expected: every page PASS with no violations, fonts loaded, images loaded.

- [ ] **Step 3: Screenshots**

With part 2's `shot.mjs` against `http://localhost:4180`, capture at 390 px and 1366 px: `/` (the header wordmark
with the gold bar), `/admin/login` (the watermark), `/privacy`; and at 1366 px the signed-in `/admin` nav. Open
`frontend/public/apple-touch-icon.png` and `frontend/public/favicon.svg` rendered in a page. Read each image and
check the gold bar reads as a bar (not a gem), sits over the "ı", and nothing scrolls sideways.

- [ ] **Step 4: Commit any fixes; stop the servers**

Each fix is its own commit with a message describing the visible change, ledgered as a Task 6 ruling.
