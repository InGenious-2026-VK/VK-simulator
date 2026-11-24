"""Platform admin: removal decisions, registrations, users, groups, audit log."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..access import audit
from ..config import settings
from ..datasets import serialize_removal, serialize_user, user_ref
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import (
    AuditEvent,
    Dataset,
    Group,
    GroupMember,
    RefreshToken,
    RemovalRequest,
    Selection,
    SimulationRun,
    User,
    now,
)
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
def users(status: Optional[str] = None, q: Optional[str] = None, paging=Depends(page_params),
          _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    query = select(User).order_by(User.email)
    if status:
        query = query.where(User.status == status)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(User.email).like(like),
                                func.lower(User.display_name).like(like),
                                func.lower(func.coalesce(User.organization, "")).like(like)))
    return paginate(db, query, paging, lambda u: serialize_user(db, u))


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
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=200)
    role: Literal["user", "admin"] = "user"
    password: Optional[str] = Field(None, min_length=8, max_length=72)
    organization: Optional[str] = Field(None, max_length=200)
    quota_bytes: Optional[int] = Field(None, ge=0)


@router.post("/users", status_code=201)
def invite(body: Invite, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    email = str(body.email).strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise ApiError(409, "user_exists", "A user with that email already exists.")
    # No mail service in the prototype: the admin sets (or receives) an initial password.
    import secrets

    password = body.password or secrets.token_urlsafe(9)
    u = User(email=email, display_name=body.display_name.strip(), role=body.role,
             password_hash=hash_password(password),
             quota_bytes=body.quota_bytes if body.quota_bytes is not None else settings.default_quota_bytes,
             organization=(body.organization or "").strip() or None)
    db.add(u)
    audit(db, admin, "user.invite", email=email)
    db.commit()
    out = serialize_user(db, u)
    if not body.password:
        out["initial_password"] = password
    return out


class UserPatch(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    organization: Optional[str] = Field(None, max_length=200)
    role: Optional[Literal["user", "admin"]] = None
    quota_bytes: Optional[int] = Field(None, ge=0)
    disabled: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=72)


def _other_active_admins(db: Session, u: User) -> int:
    return db.scalar(select(func.count()).select_from(User).where(
        User.role == "admin", User.id != u.id, User.disabled.is_(False), User.status == "active"))


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: UserPatch, admin: User = Depends(require_admin),
               db: Session = Depends(get_db)) -> dict:
    u = db.get(User, user_id)
    if u is None:
        raise not_found("user", user_id)
    fields = body.model_dump(exclude_unset=True)
    for key in ("display_name", "email", "role", "quota_bytes", "disabled"):
        if key in fields and fields[key] is None:
            raise ApiError(422, "validation_error", f"{key} cannot be null.")
    loses_admin = (fields.get("role") == "user" or fields.get("disabled") is True) and u.role == "admin"
    if loses_admin and u.id == admin.id:
        raise ApiError(409, "self_lockout", "You can't remove your own admin access or disable yourself.")
    if loses_admin and _other_active_admins(db, u) == 0:
        raise ApiError(409, "last_admin", "At least one active platform admin is required.")
    if "email" in fields:
        email = str(fields["email"]).strip().lower()
        if db.scalar(select(User).where(func.lower(User.email) == email, User.id != u.id)):
            raise ApiError(409, "user_exists", "A user with that email already exists.")
        fields["email"] = email
    if "display_name" in fields:
        fields["display_name"] = fields["display_name"].strip()
    if "organization" in fields:
        fields["organization"] = (fields["organization"] or "").strip() or None
    if "password" in fields:
        u.password_hash = hash_password(fields.pop("password"))
    for k, v in fields.items():
        setattr(u, k, v)
    if body.disabled or "password" in body.model_dump(exclude_unset=True):
        # sign the user out everywhere
        db.execute(update(RefreshToken).where(RefreshToken.user_id == u.id).values(revoked=True))
    audit(db, admin, "user.update", user_id=u.id, fields=sorted(body.model_dump(exclude_unset=True)))
    db.commit()
    return serialize_user(db, u)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, transfer_to: Optional[str] = None,
                admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    """Delete an account. Datasets it owns (including removed ones) must be
    handed to another user with `?transfer_to=<user_id>`; otherwise 409."""
    u = db.get(User, user_id)
    if u is None:
        raise not_found("user", user_id)
    if u.id == admin.id:
        raise ApiError(409, "self_lockout", "You can't delete your own account.")
    if u.role == "admin" and not u.disabled and _other_active_admins(db, u) == 0:
        raise ApiError(409, "last_admin", "At least one active platform admin is required.")
    owned = db.scalar(select(func.count()).select_from(Dataset).where(Dataset.owner_id == u.id))
    heir = None
    if transfer_to:
        heir = db.get(User, transfer_to)
        if heir is None or heir.id == u.id:
            raise ApiError(400, "validation_error", "transfer_to must be another existing user.")
    if owned and heir is None:
        raise ApiError(409, "user_has_datasets",
                       f"{u.display_name} owns {owned} dataset(s). Choose a user to transfer them to, "
                       "or disable the account instead.", {"datasets": owned})
    if heir is not None:
        db.execute(update(Dataset).where(Dataset.owner_id == u.id).values(owner_id=heir.id))
    keeper = heir.id if heir is not None else admin.id
    db.execute(update(RemovalRequest).where(RemovalRequest.requested_by_id == u.id)
               .values(requested_by_id=keeper))
    db.execute(update(RemovalRequest).where(RemovalRequest.decided_by_id == u.id)
               .values(decided_by_id=None))
    db.execute(update(SimulationRun).where(SimulationRun.user_id == u.id).values(user_id=None))
    db.execute(update(AuditEvent).where(AuditEvent.actor_id == u.id).values(actor_id=None))
    db.execute(update(User).where(User.reviewed_by_id == u.id).values(reviewed_by_id=None))
    for sel in db.scalars(select(Selection).where(Selection.created_by_id == u.id)):
        db.delete(sel)
    audit(db, admin, "user.delete", user_id=u.id, email=u.email, datasets=owned,
          transferred_to=heir.id if heir else None)
    db.delete(u)
    db.commit()
    return Response(status_code=204)


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


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: str, admin: User = Depends(require_admin),
                 db: Session = Depends(get_db)) -> Response:
    """Delete a group. Datasets shared with it become private to their owners."""
    g = db.get(Group, group_id)
    if g is None:
        raise not_found("group", group_id)
    shared = db.scalar(select(func.count()).select_from(Dataset).where(Dataset.group_id == g.id))
    db.execute(update(Dataset).where(Dataset.group_id == g.id)
               .values(group_id=None, visibility="private"))
    audit(db, admin, "group.delete", group_id=g.id, name=g.name, datasets_made_private=shared)
    db.delete(g)
    db.commit()
    return Response(status_code=204)


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
