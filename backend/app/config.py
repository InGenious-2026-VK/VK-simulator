"""Runtime configuration, read from environment variables (or `backend/.env`).

Every setting has a development default so `uvicorn app.main:app` works out of
the box against a local PostgreSQL. Override them in production.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    """Minimal .env loader (KEY=VALUE lines); real env vars win."""
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://foodchainiq:foodchainiq@localhost:5432/foodchainiq",
    )
    # Uploaded dataset files live here: <storage_dir>/datasets/<id>/v<version>/<file>
    storage_dir: Path = Path(os.environ.get("STORAGE_DIR", str(BACKEND_DIR / "storage")))

    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-only-change-me-in-production-0123456789")
    access_token_ttl_s: int = _int("ACCESS_TOKEN_TTL_S", 900)
    refresh_token_ttl_s: int = _int("REFRESH_TOKEN_TTL_S", 7 * 24 * 3600)
    # Secure cookies need HTTPS; off for local http dev.
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    # "strict" when frontend and API share a site; "none" (+ COOKIE_SECURE) for cross-site.
    cookie_samesite: str = os.environ.get("COOKIE_SAMESITE", "strict").lower()

    admin_email: str = os.environ.get("ADMIN_EMAIL", "admin@foodchainiq.local")
    admin_password: str = os.environ.get("ADMIN_PASSWORD", "admin1234")
    seed_demo: bool = _bool("SEED_DEMO", True)
    # Self-registration: "approval" (an admin approves each account), "open"
    # (accounts are active at once) or "closed" (admins create accounts).
    registration_mode: str = os.environ.get("REGISTRATION_MODE", "approval").strip().lower()

    max_upload_bytes: int = _int("MAX_UPLOAD_BYTES", 2 * 1024**3)
    max_files_per_dataset: int = _int("MAX_FILES_PER_DATASET", 50)
    default_quota_bytes: int = _int("DEFAULT_QUOTA_BYTES", 10 * 1024**3)
    max_selection_size: int = _int("MAX_SELECTION_SIZE", 20)
    selection_ttl_days: int = _int("SELECTION_TTL_DAYS", 30)
    login_max_failures: int = _int("LOGIN_MAX_FAILURES", 5)
    login_window_s: int = _int("LOGIN_WINDOW_S", 900)

    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.environ.get(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
            ).split(",")
            if o.strip()
        ]
    )


settings = Settings()
