"""SQLAlchemy engine / session wiring."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables that don't exist yet (no migrations in the prototype)."""
    from . import orm  # noqa: F401  (registers the mappers)

    Base.metadata.create_all(engine)
    # create_all never alters existing tables: add columns introduced after a
    # database was first created. Each statement is idempotent.
    with engine.begin() as conn:
        for stmt in _COLUMN_MIGRATIONS:
            conn.execute(text(stmt))


_COLUMN_MIGRATIONS = [
    # account registration / approval
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(200)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_note TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by_id VARCHAR(32)"
    " REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS review_note TEXT",
    "CREATE INDEX IF NOT EXISTS ix_users_status ON users (status)",
]
