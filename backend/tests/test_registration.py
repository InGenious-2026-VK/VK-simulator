"""Self-registration with admin approval (REGISTRATION_MODE)."""

from dataclasses import replace

import pytest

from app.routers import auth as auth_router
from conftest import login


def _register(client, email, **over):
    body = {"email": email, "display_name": "New Person", "password": "newperson123",
            "organization": "Linköping kommun", "note": "Municipal preparedness planner"}
    body.update(over)
    return client.post("/api/auth/register", json=body)


def _sign_in(client, email, password="newperson123"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_auth_config_is_public(client):
    assert client.get("/api/auth/config").json() == {"registration": "approval"}


def test_register_needs_admin_approval(client, admin, planner):
    r = _register(client, "Approve.Me@example.org")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"

    # pending: right password → 403 pending_approval; wrong password → plain 401
    r = _sign_in(client, "approve.me@example.org")
    assert r.status_code == 403 and r.json()["error"]["code"] == "pending_approval"
    assert _sign_in(client, "approve.me@example.org", "wrong-password").status_code == 401

    # only admins see the queue
    assert client.get("/api/admin/registrations", headers=planner).status_code == 403
    queue = client.get("/api/admin/registrations", headers=admin).json()["items"]
    reg = next(i for i in queue if i["email"] == "approve.me@example.org")
    assert reg["status"] == "pending" and reg["organization"] == "Linköping kommun"
    assert reg["note"] == "Municipal preparedness planner"

    r = client.post(f"/api/admin/registrations/{reg['id']}/decision", headers=admin,
                    json={"decision": "approve", "note": "Welcome"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert r.json()["reviewed_by"]["display_name"] == "Platform Admin"

    headers = login(client, "approve.me@example.org", "newperson123")
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["status"] == "active" and me["role"] == "user"

    # deciding twice is refused; the decision is audited
    r = client.post(f"/api/admin/registrations/{reg['id']}/decision", headers=admin,
                    json={"decision": "reject"})
    assert r.status_code == 409
    log = client.get("/api/admin/audit-log?action=user.registration", headers=admin).json()["items"]
    assert any(e["target"]["user_id"] == reg["id"] for e in log)
    approved = client.get("/api/admin/registrations?status=approved", headers=admin).json()["items"]
    assert any(i["id"] == reg["id"] for i in approved)


def test_rejected_registration_cannot_sign_in(client, admin):
    assert _register(client, "reject.me@example.org").status_code == 201
    queue = client.get("/api/admin/registrations", headers=admin).json()["items"]
    reg = next(i for i in queue if i["email"] == "reject.me@example.org")
    r = client.post(f"/api/admin/registrations/{reg['id']}/decision", headers=admin,
                    json={"decision": "reject", "note": "Unknown organisation"})
    assert r.json()["status"] == "rejected"
    r = _sign_in(client, "reject.me@example.org")
    assert r.status_code == 403 and r.json()["error"]["code"] == "registration_rejected"

    # an admin can still change their mind
    r = client.post(f"/api/admin/registrations/{reg['id']}/decision", headers=admin,
                    json={"decision": "approve"})
    assert r.status_code == 200
    assert _sign_in(client, "reject.me@example.org").status_code == 200


def test_register_validation(client):
    assert _register(client, "planner@foodchainiq.local").status_code in (409, 422)
    assert _register(client, "dup@example.org").status_code == 201
    r = _register(client, "DUP@example.org")
    assert r.status_code == 409 and r.json()["error"]["code"] == "user_exists"
    assert _register(client, "short@example.org", password="short").status_code == 422
    assert _register(client, "not-an-email").status_code == 422
    assert _register(client, "noname@example.org", display_name="").status_code == 422


@pytest.mark.parametrize("mode,status", [("open", 201), ("closed", 403)])
def test_registration_modes(client, monkeypatch, mode, status):
    monkeypatch.setattr(auth_router, "settings", replace(auth_router.settings, registration_mode=mode))
    assert client.get("/api/auth/config").json() == {"registration": mode}
    r = _register(client, f"mode-{mode}@example.org")
    assert r.status_code == status
    if mode == "open":
        assert r.json()["status"] == "active"
        assert _sign_in(client, f"mode-{mode}@example.org").status_code == 200
    else:
        assert r.json()["error"]["code"] == "registration_closed"


def test_invited_users_are_active(client, admin):
    r = client.post("/api/admin/users", headers=admin,
                    json={"email": "invited@example.org", "display_name": "Invited", "password": "invited1234"})
    assert r.status_code == 201 and r.json()["status"] == "active"
    assert _sign_in(client, "invited@example.org", "invited1234").status_code == 200
