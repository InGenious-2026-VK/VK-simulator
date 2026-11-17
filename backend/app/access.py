"""Who can see / change what. Every dataset read goes through here."""

from __future__ import annotations

from sqlalchemy import Select, false, or_, select
from sqlalchemy.orm import Session

from .errors import not_found
from .orm import AuditEvent, Dataset, GroupMember, User


def group_ids(db: Session, user: User) -> set[str]:
    return set(db.scalars(select(GroupMember.group_id).where(GroupMember.user_id == user.id)))


def group_role(db: Session, user: User, group_id: str) -> str | None:
    return db.scalar(
        select(GroupMember.role).where(
            GroupMember.user_id == user.id, GroupMember.group_id == group_id
        )
    )


def visible_datasets(db: Session, user: User) -> Select:
    """A SELECT of non-removed datasets the user may see."""
    q = select(Dataset).where(Dataset.removed_at.is_(None))
    if user.role == "admin":
        return q
    groups = group_ids(db, user)
    return q.where(
        or_(
            Dataset.owner_id == user.id,
            Dataset.visibility == "public",
            (Dataset.visibility == "group") & Dataset.group_id.in_(groups) if groups else false(),
        )
    )


def can_see(db: Session, user: User, ds: Dataset, groups: set[str] | None = None) -> bool:
    if ds.removed_at is not None:
        return False
    if user.role == "admin" or ds.owner_id == user.id or ds.visibility == "public":
        return True
    if ds.visibility == "group":
        groups = groups if groups is not None else group_ids(db, user)
        return ds.group_id in groups
    return False


def get_visible(db: Session, user: User, dataset_id: str) -> Dataset:
    ds = db.get(Dataset, dataset_id)
    if ds is None or not can_see(db, user, ds):
        # 404, not 403: never reveal that a private dataset exists.
        raise not_found("dataset", dataset_id)
    return ds


def audit(db: Session, actor: User | None, action: str, dataset_id: str | None = None, **target) -> None:
    db.add(
        AuditEvent(
            actor_id=actor.id if actor else None,
            action=action,
            dataset_id=dataset_id,
            target=target,
        )
    )
