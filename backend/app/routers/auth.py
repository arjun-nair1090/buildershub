import math
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.schemas import AdminCreate, AdminOut, LoginRequest, PasswordReset, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password
from app.services import rate_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])


LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_LIMITS = (("login-email", 5), ("login-ip", 20))  # failed attempts per window


def too_many_attempts(verdict: rate_limit.Verdict) -> HTTPException:
    minutes = math.ceil(verdict.retry_after / 60)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many attempts. Try again in {minutes} minute{'' if minutes == 1 else 's'}.",
        headers={"Retry-After": str(verdict.retry_after)},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    ip = rate_limit.client_ip(request)
    keys = {"login-email": body.email, "login-ip": ip}
    rate_limit.purge(db)
    # Counted before the (slow) password check, in one atomic step, so a burst of parallel guesses can't all get
    # past the limit before the first failure lands. A correct login gives its count back below.
    for scope, limit in LOGIN_LIMITS:
        verdict = rate_limit.hit(db, scope, keys[scope], limit, LOGIN_WINDOW)
        if not verdict.allowed:
            raise too_many_attempts(verdict)

    user = db.scalar(select(User).where(User.email == body.email))
    if not verify_password(body.password, user.password_hash if user else None) or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    rate_limit.clear(db, "login-email", body.email)
    rate_limit.refund(db, "login-ip", ip)  # only failures count against an address
    token, expires_in = create_access_token(user.id, user.token_version, remember=body.remember)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    # Revokes every token this user holds, so a copied token stops working too.
    # ponytail: signs out all of the user's devices, add per-session ids if single-device logout matters.
    user.token_version += 1
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/admins", response_model=list[AdminOut])
def list_admins(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at)))


@router.post("/admins", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(body: AdminCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _admin_or_404(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    return user


@router.put("/admins/{email}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_admin_password(
    email: str, body: PasswordReset, _: User = Depends(require_admin), db: Session = Depends(get_db)
) -> Response:
    user = _admin_or_404(db, email)
    user.password_hash = hash_password(body.password)
    user.token_version += 1  # sign out sessions that used the old password
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/admins/{email}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin(email: str, current: User = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    user = _admin_or_404(db, email)
    # Blocking self-removal also guarantees at least one admin always remains.
    if user.id == current.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't remove your own account")
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
