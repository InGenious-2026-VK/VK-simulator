"""Groups the caller belongs to, and group membership management."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
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


def _guard_last_admin(db: Session, actor: User, m: GroupMember) -> None:
    """A group must keep at least one group admin, unless a platform admin decides otherwise."""
    if actor.role == "admin" or m.role != "admin":
        return
    admins = db.scalar(select(func.count()).select_from(GroupMember).where(
        GroupMember.group_id == m.group_id, GroupMember.role == "admin"))
    if admins <= 1:
        raise ApiError(409, "last_group_admin",
                       "A group needs at least one group admin. Make someone else admin first.")


def _get_member(db: Session, group_id: str, user_id: str) -> GroupMember:
    m = db.scalar(select(GroupMember).where(GroupMember.group_id == group_id,
                                             GroupMember.user_id == user_id))
    if m is None:
        raise not_found("member", user_id)
    return m


@router.get("/groups")
def list_groups(paging=Depends(page_params), user: User = Depends(current_user),
                db: Session = Depends(get_db)) -> dict:
    q = select(Group).order_by(Group.name)
    if user.role != "admin":
        q = q.join(GroupMember).where(GroupMember.user_id == user.id)
    return paginate(db, q, paging, lambda g: serialize_group(db, g, user))


class GroupPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)


@router.patch("/groups/{group_id}")
def patch_group(group_id: str, body: GroupPatch, user: User = Depends(current_user),
                db: Session = Depends(get_db)) -> dict:
    """Rename / re-describe a group (group admins and platform admins)."""
    g = _load_group(db, user, group_id)
    _require_group_admin(db, user, group_id)
    fields = body.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in fields:
        fields["name"] = fields["name"].strip()
        clash = db.scalar(select(Group).where(Group.name == fields["name"], Group.id != g.id))
        if clash:
            raise ApiError(409, "group_exists", "A group with that name already exists.")
    for k, v in fields.items():
        setattr(g, k, v)
    audit(db, user, "group.update", group_id=g.id, fields=sorted(fields))
    db.commit()
    return serialize_group(db, g, user)


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
    if target.status != "active":
        raise ApiError(409, "user_not_active", "Only approved accounts can join groups.")
    m = db.scalar(select(GroupMember).where(GroupMember.group_id == group_id,
                                             GroupMember.user_id == target.id))
    if m is None:
        m = GroupMember(group_id=group_id, user_id=target.id, role=body.role)
        db.add(m)
    else:
        if body.role != "admin":
            _guard_last_admin(db, user, m)
        m.role = body.role
    audit(db, user, "group.member_add", group_id=group_id, user_id=target.id)
    db.commit()
    db.refresh(m)
    return _member(m)


class MemberPatch(BaseModel):
    role: Literal["member", "admin"]


@router.patch("/groups/{group_id}/members/{user_id}")
def patch_member(group_id: str, user_id: str, body: MemberPatch, user: User = Depends(current_user),
                 db: Session = Depends(get_db)) -> dict:
    """Change a member's group role (group admins and platform admins)."""
    _load_group(db, user, group_id)
    _require_group_admin(db, user, group_id)
    m = _get_member(db, group_id, user_id)
    if body.role != "admin":
        _guard_last_admin(db, user, m)
    m.role = body.role
    audit(db, user, "group.member_role", group_id=group_id, user_id=user_id, role=body.role)
    db.commit()
    return _member(m)


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
def remove_member(group_id: str, user_id: str, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> Response:
    """Group admins remove anyone; every member can remove themselves (leave)."""
    _load_group(db, user, group_id)
    if user_id != user.id:
        _require_group_admin(db, user, group_id)
    m = _get_member(db, group_id, user_id)
    _guard_last_admin(db, user, m)
    db.delete(m)
    audit(db, user, "group.member_remove", group_id=group_id, user_id=user_id)
    db.commit()
    return Response(status_code=204)
