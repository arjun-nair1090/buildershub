from sqlalchemy.orm import Session

from app.models import StoreSettings


def get_store(db: Session) -> StoreSettings:
    """The single settings row, created on first use."""
    store = db.get(StoreSettings, 1)
    if store is None:
        store = StoreSettings(id=1)
        db.add(store)
        db.flush()
    return store
