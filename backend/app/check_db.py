"""Wait until the configured PostgreSQL accepts connections (used by run.sh / run.bat).

    python -m app.check_db [--timeout SECONDS]

Exits 0 when the database is reachable, 1 (with a hint) when it isn't.
"""

from __future__ import annotations

import argparse
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from .config import settings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()

    url = make_url(settings.database_url)
    where = f"{url.host or 'localhost'}:{url.port or 5432}/{url.database}"
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    deadline = time.monotonic() + args.timeout
    last = None
    while time.monotonic() < deadline:
        try:
            with engine.connect() as conn:
                conn.execute(text("select 1"))
            print(f"[db] PostgreSQL is reachable at {where}")
            return 0
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1)
    print(f"[db] Cannot connect to PostgreSQL at {where} as user '{url.username}'.", file=sys.stderr)
    print(f"     {type(last).__name__}: {str(last).splitlines()[0] if last else ''}", file=sys.stderr)
    print("     Start it with 'docker compose up -d db', or point DATABASE_URL in", file=sys.stderr)
    print("     backend/.env at your own PostgreSQL (see backend/.env.example).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
