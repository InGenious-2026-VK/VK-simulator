"""Passwords, JWT access tokens, refresh tokens and the auth dependencies."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .errors import ApiError
from .orm import RefreshToken, User

ALGO = "HS256"
REFRESH_COOKIE = "fciq_refresh"


# ---------------------------------------------------------------- passwords


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


# ---------------------------------------------------------------- tokens


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(seconds=settings.access_token_ttl_s),
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def _sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_refresh_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_sha(token),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.refresh_token_ttl_s),
        )
    )
    return token


def consume_refresh_token(db: Session, token: str) -> User:
    """Validate + revoke a refresh token (rotation). Returns its user."""
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _sha(token)))
    if row is None or row.revoked or row.expires_at < datetime.now(timezone.utc):
        raise ApiError(401, "unauthenticated", "Your session has expired. Please sign in again.")
    row.revoked = True
    user = db.get(User, row.user_id)
    if user is None or user.disabled:
        raise ApiError(401, "unauthenticated", "Account unavailable.")
    return user


def revoke_refresh_token(db: Session, token: str) -> None:
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _sha(token)))
    if row is not None:
        row.revoked = True


# ---------------------------------------------------------------- dependencies


def _user_from_request(request: Request, db: Session) -> User | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "token_expired", "Access token expired.") from None
    except jwt.InvalidTokenError:
        raise ApiError(401, "unauthenticated", "Invalid access token.") from None
    if payload.get("typ") != "access":
        raise ApiError(401, "unauthenticated", "Invalid access token.")
    user = db.get(User, payload.get("sub"))
    if user is None or user.disabled:
        raise ApiError(401, "unauthenticated", "Account unavailable.")
    return user


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = _user_from_request(request, db)
    if user is None:
        raise ApiError(401, "unauthenticated", "Sign in required.")
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    return _user_from_request(request, db)


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise ApiError(403, "forbidden", "Platform admin only.")
    return user
