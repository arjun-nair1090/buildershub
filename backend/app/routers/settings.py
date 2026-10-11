from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import require_admin
from app.schemas import StoreSettingsIn, StoreSettingsOut
from app.services.gold_rate import configured_feed, current_rate
from app.services.pricing import gold_rate_out
from app.services.store import get_store_settings

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)])


def to_out(db: Session) -> StoreSettingsOut:
    settings = get_settings()
    rate = current_rate(db)
    return StoreSettingsOut(
        gst_percent=get_store_settings(db).gst_percent,
        gold_feed_configured=configured_feed(settings) is not None,
        gold_rate_ttl_minutes=settings.gold_rate_ttl_minutes,
        gold_rate=gold_rate_out(rate) if rate else None,
    )


@router.get("", response_model=StoreSettingsOut)
def read_settings(db: Session = Depends(get_db)) -> StoreSettingsOut:
    return to_out(db)


@router.put("", response_model=StoreSettingsOut)
def update_settings(body: StoreSettingsIn, db: Session = Depends(get_db)) -> StoreSettingsOut:
    get_store_settings(db).gst_percent = body.gst_percent
    db.commit()
    return to_out(db)
