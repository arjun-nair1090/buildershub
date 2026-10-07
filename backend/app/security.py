from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

# Used to keep login timing similar whether or not the email exists.
_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    candidate = password_hash or _DUMMY_HASH
    ok = bcrypt.checkpw(password.encode(), candidate.encode())
    return ok and password_hash is not None


def create_access_token(user_id: int, remember: bool = False) -> tuple[str, int]:
    settings = get_settings()
    lifetime = (
        timedelta(days=settings.remember_me_expire_days)
        if remember
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + lifetime}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> int | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
