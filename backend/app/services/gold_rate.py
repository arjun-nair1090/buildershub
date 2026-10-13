"""Market gold rate from metals.dev, GoldAPI.io or the keyless gold-api.com, cached in the database.

Every page view reads the cached rate; the API is only called when the cache is older than
GOLD_RATE_TTL_MINUTES, so the request count stays fixed however many buyers scan a QR code.
"""
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import GoldRate
from app.services.store import get_store_settings

log = logging.getLogger(__name__)

METALS_DEV_URL = "https://api.metals.dev/v1/latest"
GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR"
GOLD_API_COM_URL = "https://api.gold-api.com/price/XAU/INR"
GRAMS_PER_TROY_OUNCE = Decimal("31.1034768")
# After a failed fetch, wait this long before trying again.
RETRY_AFTER = timedelta(minutes=5)


@dataclass
class RateSnapshot:
    inr_per_gram_24k: Decimal
    previous: Decimal | None
    fetched_at: datetime
    source: str


def _aware(dt: datetime) -> datetime:
    # SQLite (used in tests) hands back naive datetimes; they were stored as UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def configured_feed(settings: Settings) -> tuple[str, str] | None:
    """(provider, api key) of the rate feed in use, or None. metals.dev wins when both keys are set."""
    if settings.metals_dev_api_key:
        return "metals.dev", settings.metals_dev_api_key
    if settings.goldapi_key:
        return "goldapi", settings.goldapi_key
    if settings.gold_rate_keyless_feed:
        return "gold-api.com", ""
    return None


def _get_json(request: urllib.request.Request) -> dict:
    with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 (fixed https URLs)
        return json.load(response)


def fetch_inr_per_gram_24k(provider: str, api_key: str) -> tuple[Decimal, str]:
    """INR per gram of pure gold and the source to credit. Raises on any network or payload problem."""
    if provider == "metals.dev":
        query = urllib.parse.urlencode({"api_key": api_key, "currency": "INR", "unit": "g"})
        data = _get_json(urllib.request.Request(f"{METALS_DEV_URL}?{query}", headers={"Accept": "application/json"}))
        if data.get("status") != "success":
            raise ValueError(f"metals.dev error {data.get('error_code')}: {data.get('error_message')}")
        metals = data["metals"]
        # IBJA's benchmark includes import duty, so it tracks Indian shop rates; the spot rate is the fallback.
        if metals.get("ibja_gold"):
            value, source = metals["ibja_gold"], "IBJA via metals.dev"
        else:
            value, source = metals["gold"], "metals.dev"
    elif provider == "gold-api.com":
        data = _get_json(urllib.request.Request(GOLD_API_COM_URL, headers={"Accept": "application/json"}))
        value, source = Decimal(str(data["price"])) / GRAMS_PER_TROY_OUNCE, "gold-api.com spot"
    else:
        data = _get_json(urllib.request.Request(GOLDAPI_URL, headers={"x-access-token": api_key, "Accept": "application/json"}))
        value, source = data["price_gram_24k"], "GoldAPI.io"
    value = Decimal(str(value))
    if not value > 0:
        raise ValueError(f"Unexpected gold rate {value!r}")
    return value.quantize(Decimal("0.01")), source


def current_rate(db: Session) -> RateSnapshot | None:
    """Latest known rate, refreshed from the API when stale. None if no rate has ever been fetched."""
    settings = get_settings()
    feed = configured_feed(settings)
    now = datetime.now(timezone.utc)
    latest = db.scalars(select(GoldRate).order_by(GoldRate.fetched_at.desc()).limit(2)).all()

    stale = not latest or now - _aware(latest[0].fetched_at) > timedelta(minutes=settings.gold_rate_ttl_minutes)
    if feed and stale:
        store = get_store_settings(db)
        checked = store.gold_rate_checked_at
        if checked is None or now - _aware(checked) > RETRY_AFTER:
            # Recorded before the call so concurrent requests don't all hit the API at once.
            store.gold_rate_checked_at = now
            db.commit()
            try:
                value, source = fetch_inr_per_gram_24k(*feed)
            except Exception:
                log.exception("Gold rate fetch failed; using the last known rate")
            else:
                row = GoldRate(inr_per_gram_24k=value, source=source, fetched_at=now)
                db.add(row)
                db.commit()
                latest = [row, *latest[:1]]

    if not latest:
        return None
    return RateSnapshot(
        inr_per_gram_24k=latest[0].inr_per_gram_24k,
        previous=latest[1].inr_per_gram_24k if len(latest) > 1 else None,
        fetched_at=_aware(latest[0].fetched_at),
        source=latest[0].source,
    )
