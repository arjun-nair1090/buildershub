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
