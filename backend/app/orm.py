"""Database tables (SQLAlchemy 2.0 declarative)."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def _id(prefix: str):
    return mapped_column(String(32), primary_key=True, default=lambda: new_id(prefix))


def _ts():
    return mapped_column(DateTime(timezone=True), default=now, nullable=False)


# ---------------------------------------------------------------- users


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = _id("usr")
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(16), default="user")  # user | admin
    quota_bytes: Mapped[int] = mapped_column(BigInteger)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()

    # Account approval: active | pending (self-registered, awaiting an admin) | rejected
    status: Mapped[str] = mapped_column(
        String(16), default="active", server_default="active", index=True
    )
    organization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    registration_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    self_registered: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    reviewed_by_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    memberships: Mapped[list["GroupMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = _id("grp")
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = _ts()

    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="member")  # member | admin
    added_at: Mapped[datetime] = _ts()

    group: Mapped[Group] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = _id("rt")
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    success: Mapped[bool] = mapped_column(Boolean)
    at: Mapped[datetime] = _ts()


# ---------------------------------------------------------------- datasets


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = _id("ds")
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32), index=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(16), index=True)  # private|group|public
    group_id: Mapped[Optional[str]] = mapped_column(ForeignKey("groups.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="processing", index=True)
    status_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(16))
    license: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship()
    group: Mapped[Optional[Group]] = relationship()
    versions: Mapped[list["DatasetVersion"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan", order_by="DatasetVersion.version"
    )

    def version_row(self, version: int | None = None) -> "DatasetVersion | None":
        want = version or self.version
        return next((v for v in self.versions if v.version == want), None)


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("dataset_id", "version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    meta: Mapped[dict] = mapped_column("metadata", JSON)
    # Filled by ingestion: { record_count, bbox, has_geometry, fields, charts }
    summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = _ts()

    dataset: Mapped[Dataset] = relationship(back_populates="versions")
    files: Mapped[list["DatasetFile"]] = relationship(
        back_populates="version_row", cascade="all, delete-orphan", order_by="DatasetFile.name"
    )


class DatasetFile(Base):
    __tablename__ = "dataset_files"

    id: Mapped[str] = _id("f")
    version_id: Mapped[int] = mapped_column(ForeignKey("dataset_versions.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    format: Mapped[str] = mapped_column(String(16))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    record_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    storage_path: Mapped[str] = mapped_column(Text)
    columns: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    version_row: Mapped[DatasetVersion] = relationship(back_populates="files")


class RemovalRequest(Base):
    __tablename__ = "removal_requests"

    id: Mapped[str] = _id("rr")
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id"), index=True)
    requested_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    decided_by_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    decision_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _ts()
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    dataset: Mapped[Dataset] = relationship()
    requested_by: Mapped[User] = relationship(foreign_keys=[requested_by_id])
    decided_by: Mapped[Optional[User]] = relationship(foreign_keys=[decided_by_id])


# ---------------------------------------------------------------- selections & runs


class Selection(Base):
    __tablename__ = "selections"

    id: Mapped[str] = _id("sel")
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    # [{ "id": "ds_…", "version": 3 }, …] in the user's order
    items: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = _ts()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    summary_cache: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = _id("run")
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    selection_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    scenario: Mapped[dict] = mapped_column(JSON)
    inputs: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = _ts()
    # The user's rating of the result: up | meh | down (None = not rated).
    feedback: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    feedback_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class DatasetRunUsage(Base):
    """One row per dataset version used in a stored simulation run.

    The source of both quality scores (see app/scores.py). Runs by platform
    admins are not recorded, so they never affect a score."""

    __tablename__ = "dataset_run_usage"
    __table_args__ = (
        UniqueConstraint("run_id", "dataset_id"),
        Index("ix_dataset_run_usage_dataset_version", "dataset_id", "version"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    # The dataset's simulation role in that run. "reference" = map only.
    role: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = _ts()


class AuditEvent(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = _ts()
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    dataset_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    target: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    actor: Mapped[Optional[User]] = relationship()


# ---------------------------------------------------------------- public site


class ContactMessage(Base):
    """A message sent from the public contact form."""

    __tablename__ = "contact_messages"

    id: Mapped[str] = _id("msg")
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), index=True)
    organization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    topic: Mapped[str] = mapped_column(String(32), default="general")
    message: Mapped[str] = mapped_column(Text)
    handled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = _ts()
