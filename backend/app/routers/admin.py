"""Platform admin: removal decisions, registrations, users, groups, audit log."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import audit
from ..config import settings
from ..datasets import serialize_removal, serialize_user, user_ref
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import AuditEvent, Group, RemovalRequest, User, now
from ..security import hash_password, require_admin
from .common import page_params, paginate
from .groups import serialize_group

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/removal-requests")
def queue(status: Optional[str] = "pending", paging=Depends(page_params),
          _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    q = select(RemovalRequest).order_by(RemovalRequest.created_at.desc())
    if status and status != "all":
        q = q.where(RemovalRequest.status == status)
    return paginate(db, q, paging, serialize_removal)


class Decision(BaseModel):
    decision: Literal["approve", "reject"]
    note: Optional[str] = None


@router.post("/removal-requests/{request_id}/decision")
def decide(request_id: str, body: Decision, admin: User = Depends(require_admin),
           db: Session = Depends(get_db)) -> dict:
    rr = db.get(RemovalRequest, request_id)
    if rr is None:
        raise not_found("request", request_id)
    if rr.status != "pending":
        raise ApiError(409, "not_pending", f"The request is already {rr.status}.")
    rr.status = "approved" if body.decision == "approve" else "rejected"
    rr.decided_by_id = admin.id
    rr.decision_note = body.note
    rr.decided_at = now()
    if rr.status == "approved":
        rr.dataset.removed_at = now()
        rr.dataset.status = "removed"
    audit(db, admin, "removal.decision", rr.dataset_id, decision=rr.status, note=body.note)
    db.commit()
    return serialize_removal(rr)


@router.get("/users")
def users(status: Optional[str] = None, paging=Depends(page_params),
          _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    q = select(User).order_by(User.email)
    if status:
        q = q.where(User.status == status)
    return paginate(db, q, paging, lambda u: serialize_user(db, u))


# ---------------------------------------------------------------- registrations


def serialize_registration(db: Session, u: User) -> dict:
    reviewer = db.get(User, u.reviewed_by_id) if u.reviewed_by_id else None
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "organization": u.organization,
        "note": u.registration_note,
        "status": "approved" if u.status == "active" else u.status,
        "created_at": u.created_at,
        "reviewed_by": user_ref(reviewer),
        "reviewed_at": u.reviewed_at,
        "review_note": u.review_note,
    }


@router.get("/registrations")
def registrations(status: Literal["pending", "approved", "rejected", "all"] = "pending",
                  paging=Depends(page_params), _: User = Depends(require_admin),
                  db: Session = Depends(get_db)) -> dict:
    """Self-registered accounts. `approved` = active accounts an admin approved."""
    q = select(User).where(User.self_registered.is_(True)).order_by(User.created_at.desc())
    if status == "approved":
        q = q.where(User.status == "active")
    elif status != "all":
        q = q.where(User.status == status)
    return paginate(db, q, paging, lambda u: serialize_registration(db, u))


@router.post("/registrations/{user_id}/decision")
def decide_registration(user_id: str, body: Decision, admin: User = Depends(require_admin),
                        db: Session = Depends(get_db)) -> dict:
    u = db.get(User, user_id)
    if u is None or not u.self_registered:
        raise not_found("registration", user_id)
    if u.status == "active":
        raise ApiError(409, "not_pending", "The account is already approved.")
    if u.status == "rejected" and body.decision == "reject":
        raise ApiError(409, "not_pending", "The registration is already rejected.")
    u.status = "active" if body.decision == "approve" else "rejected"
    u.reviewed_by_id = admin.id
    u.reviewed_at = now()
    u.review_note = body.note
    audit(db, admin, "user.registration", user_id=u.id, email=u.email,
          decision="approved" if u.status == "active" else "rejected", note=body.note)
    db.commit()
    return serialize_registration(db, u)


class Invite(BaseModel):
    email: str
    display_name: str = Field(min_length=1)
    role: Literal["user", "admin"] = "user"
    password: Optional[str] = Field(None, min_length=8)


@router.post("/users", status_code=201)
def invite(body: Invite, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    email = body.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise ApiError(409, "user_exists", "A user with that email already exists.")
    # No mail service in the prototype: the admin sets (or receives) an initial password.
    import secrets

    password = body.password or secrets.token_urlsafe(9)
    u = User(email=email, display_name=body.display_name, role=body.role,
             password_hash=hash_password(password), quota_bytes=settings.default_quota_bytes)
    db.add(u)
    audit(db, admin, "user.invite", email=email)
    db.commit()
    out = serialize_user(db, u)
    if not body.password:
        out["initial_password"] = password
    return out


class UserPatch(BaseModel):
    role: Optional[Literal["user", "admin"]] = None
    quota_bytes: Optional[int] = Field(None, ge=0)
    disabled: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: UserPatch, admin: User = Depends(require_admin),
               db: Session = Depends(get_db)) -> dict:
    u = db.get(User, user_id)
    if u is None:
        raise not_found("user", user_id)
    fields = body.model_dump(exclude_unset=True)
    if "password" in fields:
        u.password_hash = hash_password(fields.pop("password"))
    for k, v in fields.items():
        setattr(u, k, v)
    audit(db, admin, "user.update", user_id=u.id, fields=sorted(body.model_dump(exclude_unset=True)))
    db.commit()
    return serialize_user(db, u)


class NewGroup(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str = ""


@router.post("/groups", status_code=201)
def create_group(body: NewGroup, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(Group).where(Group.name == body.name)):
        raise ApiError(409, "group_exists", "A group with that name already exists.")
    g = Group(name=body.name, description=body.description)
    db.add(g)
    audit(db, admin, "group.create", name=body.name)
    db.commit()
    return serialize_group(db, g, admin)


@router.get("/audit-log")
def audit_log(actor_id: Optional[str] = None, dataset_id: Optional[str] = None,
              action: Optional[str] = None, from_: Optional[str] = Query(None, alias="from"),
              to: Optional[str] = None,
              paging=Depends(page_params), _: User = Depends(require_admin),
              db: Session = Depends(get_db)) -> dict:
    q = select(AuditEvent).order_by(AuditEvent.at.desc(), AuditEvent.id.desc())
    if actor_id:
        q = q.where(AuditEvent.actor_id == actor_id)
    if dataset_id:
        q = q.where(AuditEvent.dataset_id == dataset_id)
    if action:
        q = q.where(AuditEvent.action == action)
    if from_:
        q = q.where(AuditEvent.at >= from_)
    if to:
        q = q.where(AuditEvent.at <= to)
    return paginate(db, q, paging, lambda e: {
        "id": e.id, "at": e.at, "actor": user_ref(e.actor), "action": e.action,
        "dataset_id": e.dataset_id, "target": e.target,
    })
