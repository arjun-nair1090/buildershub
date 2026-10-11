# Marketplace, part 4: brand and hardening

Date: 11 Oct 2026
Status: approved in discussion, awaiting spec review

## Context

Parts 1 to 3 built the marketplace: stores, pieces, designs, the buyer pages, search, Near me and the feed.
Part 4 finishes the brief: item 5 (replace the diamond with a gold bar mark) and the nice-to-haves (security
headers, rate limiting on the verify and login pages, a privacy policy page). It is the last part.

## Goals

- No diamond graphic anywhere; a gold bar mark in the logo, favicon and icons.
- Security headers on every page and API response, without breaking fonts, photos, the map or the admin.
- Rate limits that hold across Vercel's serverless instances: login against password guessing, verify against
  code guessing.
- A privacy page that says plainly what is and isn't collected.

## Non-goals (this part)

- Rate limits on other endpoints (the catalogue and gold rate are CDN-cached; photo bytes are immutable).
- CAPTCHAs, account lockout emails, a WAF.
- Legal review of the privacy text; a cookie banner (there are no tracking cookies).
- Real operator name and contact details: placeholders until launch.

## 1. Gold bar mark

- `GoldBar` (in `frontend/src/components/layout/BrandMark.tsx`, replacing `Gem`): an SVG ingot seen from the
  front, viewBox `0 0 24 20` like the gem it replaces so the wordmark keeps its spacing. Two faces: a top face
  (lighter gold) and a front trapezoid (the existing gradient `#F3DDA6` → `#D4AE6A` → `#9C7637`), with a thin
  white highlight along the top edge at 50% opacity. `aria-hidden`.
- The wordmark dots the "ı" with `GoldBar`, same size, position and hover lift as today.
- `GoldBarIcon`: a line icon in lucide's style (24 x 24, `stroke="currentColor"`, stroke width 2, round joins)
  with the same ingot outline, for places that used lucide's `Gem`: the admin nav ("Pieces"), the dashboard card
  and the empty Pieces list.
- Login page: the large faded `Gem` watermark becomes `GoldBar`.
- `frontend/public/favicon.svg`: the ingot on the basalt rounded square (32 x 32, radius 7), replacing the gem.
- `frontend/public/apple-touch-icon.png`: 180 x 180 PNG of the same design (rendered from the SVG with headless
  Chrome), linked from `index.html`.
- After the change, no source file imports `Gem` from lucide or defines the gem path.

## 2. Security headers

### Pages (`vercel.json`)

A top-level `headers` entry for `/(.*)`:

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src https://www.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `geolocation=(self), camera=(), microphone=(), payment=(), usb=()` |
| X-Frame-Options | `DENY` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains` |

`'unsafe-inline'` for styles is needed for React `style` attributes (animation delays); scripts stay strict.
`blob:` images are the admin's signed-in photo previews.

### API (FastAPI middleware)

Every response from the app gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`X-Frame-Options: DENY` and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, except the
local API docs (`/docs`, `/redoc`, `/openapi.json`), which need scripts. Responses that already set one of these
keep their own value.

## 3. Rate limiting

### Storage

New table `rate_limits` (migration 0006):

| Column | Type | Notes |
|---|---|---|
| key | str(80), primary key | `{scope}:{hash}`, e.g. `login-email:3f9a...` |
| window_start | timestamptz | start of the current fixed window |
| count | int | hits in the window |

The hash is HMAC-SHA256 of the email (lower-cased) or IP address, keyed with `JWT_SECRET`, first 32 hex
characters. No raw email or IP is ever stored.

### Counting

`app/services/rate_limit.py`:

- `hit(db, scope, value, limit, window, now) -> Verdict` adds one to the counter in a single atomic
  insert-or-update (`INSERT ... ON CONFLICT (key) DO UPDATE`, resetting to 1 when the stored window has ended)
  and returns `Verdict(allowed, retry_after_seconds)`. Allowed while the count is within the limit.
- `peek(db, scope, value, limit, window, now) -> Verdict` reads without counting.
- `clear(db, scope, value)` deletes the counter.
- `purge(db, now)` deletes rows whose window started more than a day ago; run on every login attempt.
- `client_ip(request)`: the first address in `X-Forwarded-For` (Vercel sets it to the client's IP), else
  `request.client.host`, else `"unknown"`.

### Rules

| Route | Scope | Limit | What counts |
|---|---|---|---|
| `POST /api/auth/login` | `login-email` | 5 per 15 min | failed attempts for that email |
| `POST /api/auth/login` | `login-ip` | 20 per 15 min | failed attempts from that IP |
| `GET /api/verify/{token}` | `verify-ip` | 60 per minute | every lookup from that IP |

- Login: before checking the password, `peek` both login scopes; if either is over, return 429. On a failed
  password, `hit` both. On success, `clear` the email scope (the IP scope stays).
- Verify: `hit` first; over the limit returns 429 without looking up the record.
- 429 responses carry `Retry-After: <seconds>` and a plain message: login "Too many attempts. Try again in
  {n} minutes." (n rounded up), verify "Too many lookups. Try again in a minute."
- The frontend already shows the server's message on the login form and on the verify error state; no new UI.

## 4. Privacy page (`/privacy`)

- `frontend/src/config/site.ts` exports `OPERATOR = "[Your company name]"` and
  `CONTACT_EMAIL = "[contact email]"`; the page shows them as they are, brackets included, until replaced.
- Sections: Who runs Jewlerify; What buyers share (nothing personal, no accounts); Location (asked only on Near
  me, used on the device, never sent or stored); Saved pieces (kept in this browser's local storage); Rate
  limiting (IP addresses and login emails kept only as keyed hashes, deleted within a day); Hosting logs (Vercel
  keeps standard request logs); Team accounts (name, email, a hashed password); Photos (re-encoded on upload, which
  removes location data); Cookies (none for tracking or advertising; the team login is kept in the browser's
  storage); Contact.
- "Last updated 11 Oct 2026" at the top.
- Footer link "Privacy" on every public page.

## Error handling

- A rate-limit table failure must not lock people out: if the counter query raises, log it and allow the request.
- 429 on verify shows the existing "could not be checked" state with the server's message and a retry link.

## Testing

Backend (pytest, SQLite):

- `hit` counts within a window, blocks past the limit with the right `retry_after`, and starts over when the
  window ends (time passed in, not slept).
- Login: the 6th failed attempt for one email returns 429 even with the right password; the IP limit blocks a
  21st failure across different emails; a success clears the email count; `Retry-After` is set.
- Verify: the 61st lookup in a minute from one IP returns 429 with `Retry-After`; another IP is unaffected.
- No raw email or IP appears in `rate_limits`.
- A counter failure lets the request through.
- API responses carry the four headers; `/docs` doesn't get the strict CSP.
- Migration 0006 runs up, down and up.

Frontend:

- `npm run build`.
- Screenshots of the header wordmark, the login page, the admin nav and the favicon.
- A headless-Chrome script that applies the exact `vercel.json` headers to the local site (DevTools `Fetch`
  interception) and loads home, search, a store page (with its map), the feed and the admin dashboard, failing on
  any CSP violation in the console.

## Rollout

Run migration 0006 against production, deploy with `vercel deploy --prod`, then read the live headers back with
`curl -I` and repeat the CSP check against the live site.
