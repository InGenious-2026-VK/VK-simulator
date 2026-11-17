"""Groups the caller belongs to, and group membership management."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import audit, group_role
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import Group, GroupMember, User
from ..security import current_user
from .common import page_params, paginate

router = APIRouter(tags=["Groups"])


def serialize_group(db: Session, g: Group, user: User) -> dict:
    count = db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == g.id))
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "role": group_role(db, user, g.id),
        "member_count": count,
    }


def _member(m: GroupMember) -> dict:
    return {"user": {"id": m.user.id, "display_name": m.user.display_name, "email": m.user.email},
            "role": m.role, "added_at": m.added_at}


def _load_group(db: Session, user: User, group_id: str) -> Group:
    g = db.get(Group, group_id)
    if g is None or (user.role != "admin" and group_role(db, user, group_id) is None):
        raise not_found("group", group_id)
    return g


def _require_group_admin(db: Session, user: User, group_id: str) -> None:
    if user.role != "admin" and group_role(db, user, group_id) != "admin":
        raise ApiError(403, "forbidden", "Group admins only.")


@router.get("/groups")
def list_groups(paging=Depends(page_params), user: User = Depends(current_user),
                db: Session = Depends(get_db)) -> dict:
    q = select(Group).order_by(Group.name)
    if user.role != "admin":
        q = q.join(GroupMember).where(GroupMember.user_id == user.id)
    return paginate(db, q, paging, lambda g: serialize_group(db, g, user))


@router.get("/groups/{group_id}/members")
def list_members(group_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    g = _load_group(db, user, group_id)
    return {"items": [_member(m) for m in sorted(g.members, key=lambda m: m.user.display_name)]}


class AddMember(BaseModel):
    user_id: str | None = None
    email: str | None = None
    role: Literal["member", "admin"] = "member"


@router.post("/groups/{group_id}/members", status_code=201)
def add_member(group_id: str, body: AddMember, user: User = Depends(current_user),
               db: Session = Depends(get_db)) -> dict:
    _load_group(db, user, group_id)
    _require_group_admin(db, user, group_id)
    target = db.get(User, body.user_id) if body.user_id else None
    if target is None and body.email:
        target = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if target is None:
        raise not_found("user", body.user_id or body.email or "?")
    m = db.scalar(select(GroupMember).where(GroupMember.group_id == group_id,
                                             GroupMember.user_id == target.id))
    if m is None:
        m = GroupMember(group_id=group_id, user_id=target.id, role=body.role)
        db.add(m)
    else:
        m.role = body.role
    audit(db, user, "group.member_add", group_id=group_id, user_id=target.id)
    db.commit()
    db.refresh(m)
    return _member(m)


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
def remove_member(group_id: str, user_id: str, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> Response:
    _load_group(db, user, group_id)
    _require_group_admin(db, user, group_id)
    m = db.scalar(select(GroupMember).where(GroupMember.group_id == group_id,
                                             GroupMember.user_id == user_id))
    if m is None:
        raise not_found("member", user_id)
    db.delete(m)
    audit(db, user, "group.member_remove", group_id=group_id, user_id=user_id)
    db.commit()
    return Response(status_code=204)
