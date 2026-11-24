"""Public contact form, and the admin inbox for it."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import audit
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import ContactMessage, User
from ..security import require_admin
from .common import page_params, paginate

router = APIRouter(tags=["Contact"])

MAX_PER_HOUR = 5  # per sender email, and per hour across everyone ×20


class ContactBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    organization: Optional[str] = Field(None, max_length=200)
    topic: Literal["general", "demo", "pricing", "support", "privacy"] = "general"
    message: str = Field(min_length=10, max_length=5000)
    # Honeypot: a hidden field real visitors leave empty.
    website: Optional[str] = None


@router.post("/contact", status_code=202)
def contact(body: ContactBody, db: Session = Depends(get_db)) -> dict:
    ok = {"status": "received", "message": "Thanks — we'll get back to you soon."}
    if body.website:
        return ok  # silently drop bots
    email = str(body.email).strip().lower()
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = select(func.count()).select_from(ContactMessage).where(ContactMessage.created_at >= since)
    if (db.scalar(recent.where(ContactMessage.email == email)) >= MAX_PER_HOUR
            or db.scalar(recent) >= MAX_PER_HOUR * 20):
        raise ApiError(429, "rate_limited", "Too many messages. Please try again later.")
    db.add(ContactMessage(
        name=body.name.strip(), email=email,
        organization=(body.organization or "").strip() or None,
        topic=body.topic, message=body.message.strip(),
    ))
    db.commit()
    return ok


def _serialize(m: ContactMessage) -> dict:
    return {"id": m.id, "name": m.name, "email": m.email, "organization": m.organization,
            "topic": m.topic, "message": m.message, "handled": m.handled, "created_at": m.created_at}


@router.get("/admin/contact-messages", tags=["Admin"])
def inbox(status: Literal["open", "handled", "all"] = "open", paging=Depends(page_params),
          _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    q = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    if status != "all":
        q = q.where(ContactMessage.handled.is_(status == "handled"))
    return paginate(db, q, paging, _serialize)


class MessagePatch(BaseModel):
    handled: bool


@router.patch("/admin/contact-messages/{message_id}", tags=["Admin"])
def mark(message_id: str, body: MessagePatch, admin: User = Depends(require_admin),
         db: Session = Depends(get_db)) -> dict:
    m = db.get(ContactMessage, message_id)
    if m is None:
        raise not_found("message", message_id)
    m.handled = body.handled
    audit(db, admin, "contact.update", message_id=m.id, handled=body.handled)
    db.commit()
    return _serialize(m)
