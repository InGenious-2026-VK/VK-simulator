"""Window 1 — Home: register / sign in / refresh / sign out / me, and public stats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import audit
from ..config import settings
from ..datasets import serialize_user
from ..db import get_db
from ..errors import ApiError
from ..orm import Dataset, LoginAttempt, User
from ..security import (
    REFRESH_COOKIE,
    consume_refresh_token,
    create_access_token,
    current_user,
    hash_password,
    issue_refresh_token,
    revoke_refresh_token,
    verify_password,
)

router = APIRouter(tags=["Auth"])


class LoginBody(BaseModel):
    email: str
    password: str


def _token_response(db: Session, response: Response, user: User) -> dict:
    refresh = issue_refresh_token(db, user)
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_ttl_s,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/api/auth",
    )
    return {
        "access_token": create_access_token(user),
        "token_type": "Bearer",
        "expires_in": settings.access_token_ttl_s,
        "user": serialize_user(db, user),
    }


@router.post("/auth/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)) -> dict:
    email = body.email.strip().lower()
    since = datetime.now(timezone.utc) - timedelta(seconds=settings.login_window_s)
    failures = db.scalar(
        select(func.count()).select_from(LoginAttempt).where(
            LoginAttempt.email == email, LoginAttempt.success.is_(False), LoginAttempt.at >= since
        )
    )
    if failures >= settings.login_max_failures:
        raise ApiError(429, "rate_limited", "Too many failed sign-in attempts. Try again later.",
                       headers={"Retry-After": str(settings.login_window_s)})

    user = db.scalar(select(User).where(func.lower(User.email) == email))
    ok = user is not None and not user.disabled and verify_password(body.password, user.password_hash)
    db.add(LoginAttempt(email=email, success=ok))
    if not ok:
        db.commit()
        raise ApiError(401, "invalid_credentials", "Wrong email or password.")
    # Only reached with the right password, so this reveals nothing to a guesser.
    if user.status == "pending":
        db.commit()
        raise ApiError(403, "pending_approval",
                       "Your registration is waiting for an administrator to approve it.")
    if user.status != "active":
        db.commit()
        raise ApiError(403, "registration_rejected",
                       "Your registration was not approved. Contact an administrator.")
    audit(db, user, "login")
    out = _token_response(db, response, user)
    db.commit()
    return out


@router.get("/auth/config")
def auth_config() -> dict:
    """What the sign-in dialog may offer: registration is "approval", "open" or "closed"."""
    return {"registration": _registration_mode()}


def _registration_mode() -> str:
    mode = settings.registration_mode
    return mode if mode in {"approval", "open", "closed"} else "approval"


class RegisterBody(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=72)
    organization: Optional[str] = Field(None, max_length=200)
    note: Optional[str] = Field(None, max_length=1000)


@router.post("/auth/register", status_code=201)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> dict:
    """Self-registration. With REGISTRATION_MODE=approval the account stays
    `pending` (it cannot sign in) until a platform admin approves it."""
    mode = _registration_mode()
    if mode == "closed":
        raise ApiError(403, "registration_closed",
                       "Self-registration is turned off. Ask an administrator for an account.")
    if len(body.password.encode()) > 72:
        raise ApiError(422, "validation_error", "Password is too long (max 72 bytes).")
    email = str(body.email).strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise ApiError(409, "user_exists", "An account with that email already exists.")
    user = User(
        email=email,
        display_name=body.display_name.strip(),
        password_hash=hash_password(body.password),
        role="user",
        quota_bytes=settings.default_quota_bytes,
        status="pending" if mode == "approval" else "active",
        organization=(body.organization or "").strip() or None,
        registration_note=(body.note or "").strip() or None,
        self_registered=True,
    )
    db.add(user)
    db.flush()
    audit(db, user, "user.register", user_id=user.id, email=email, status=user.status)
    db.commit()
    return {
        "status": user.status,
        "message": "Thanks — an administrator will review your registration."
        if user.status == "pending" else "Your account is ready. You can sign in now.",
    }


@router.post("/auth/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise ApiError(401, "unauthenticated", "No session.")
    user = consume_refresh_token(db, token)
    out = _token_response(db, response, user)
    db.commit()
    return out


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh_token(db, token)
        db.commit()
    response = Response(status_code=204)
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    return response


@router.get("/auth/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return serialize_user(db, user)


@router.get("/stats/public")
def public_stats(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(Dataset.category, func.count()).where(
            Dataset.visibility == "public", Dataset.removed_at.is_(None), Dataset.status == "ready"
        ).group_by(Dataset.category)
    ).all()
    cats = {c: n for c, n in rows}
    return {"public_datasets": sum(cats.values()), "categories": cats}
