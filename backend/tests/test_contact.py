"""Public contact form and the admin inbox."""

from conftest import login


def _send(client, **over):
    body = {"name": "Kim Svensson", "email": "kim@example.org", "organization": "Region X",
            "topic": "demo", "message": "We would like a demo for our county."}
    body.update(over)
    return client.post("/api/contact", json=body)


def test_contact_form_reaches_admin_inbox(client, admin, planner):
    r = _send(client)
    assert r.status_code == 202, r.text
    assert client.get("/api/admin/contact-messages", headers=planner).status_code == 403
    inbox = client.get("/api/admin/contact-messages", headers=admin).json()["items"]
    msg = next(m for m in inbox if m["email"] == "kim@example.org")
    assert (msg["topic"], msg["organization"], msg["handled"]) == ("demo", "Region X", False)

    r = client.patch(f"/api/admin/contact-messages/{msg['id']}", headers=admin, json={"handled": True})
    assert r.status_code == 200 and r.json()["handled"] is True
    open_ids = {m["id"] for m in client.get("/api/admin/contact-messages", headers=admin).json()["items"]}
    assert msg["id"] not in open_ids
    handled = client.get("/api/admin/contact-messages?status=handled", headers=admin).json()["items"]
    assert msg["id"] in {m["id"] for m in handled}


def test_contact_validation_spam_and_rate_limit(client, admin):
    assert _send(client, email="not-an-email").status_code == 422
    assert _send(client, message="short").status_code == 422
    assert _send(client, topic="nonsense").status_code == 422
    # honeypot: accepted but not stored
    assert _send(client, email="bot@example.org", website="http://spam").status_code == 202
    inbox = client.get("/api/admin/contact-messages?status=all&page_size=100", headers=admin).json()["items"]
    assert all(m["email"] != "bot@example.org" for m in inbox)
    # per-sender limit
    codes = [_send(client, email="flood@example.org").status_code for _ in range(6)]
    assert codes[:5] == [202] * 5 and codes[5] == 429
