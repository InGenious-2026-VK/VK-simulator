"""Test setup: a throwaway PostgreSQL database and storage folder.

Uses TEST_DATABASE_URL (default: the local `foodchainiq_test` database). Every
test session drops and recreates all tables.
"""

import os
import tempfile

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://foodchainiq:foodchainiq@localhost:5432/foodchainiq_test",
    ),
)
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="fciq-test-")
os.environ["SEED_DEMO"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app import orm  # noqa: F401
    from app.main import app

    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def planner(client):
    return login(client, "planner@foodchainiq.local", "planner1234")


@pytest.fixture(scope="session")
def producer(client):
    return login(client, "producer@foodchainiq.local", "producer1234")


@pytest.fixture(scope="session")
def admin(client):
    return login(client, "admin@foodchainiq.local", "admin1234")
