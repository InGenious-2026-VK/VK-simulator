"""Group membership management and platform-admin user / group management."""

from conftest import login


def _user(client, admin, email, name="Test Person", password="testperson1"):
    r = client.post("/api/admin/users", headers=admin,
                    json={"email": email, "display_name": name, "password": password})
    assert r.status_code == 201, r.text
    return r.json(), login(client, email, password)


def _group(client, admin, name):
    r = client.post("/api/admin/groups", headers=admin, json={"name": name, "description": "d"})
    assert r.status_code == 201, r.text
    return r.json()


def _members(client, headers, gid):
    return {m["user"]["id"]: m["role"] for m in client.get(f"/api/groups/{gid}/members", headers=headers).json()["items"]}


def test_group_admin_manages_members_and_members_can_leave(client, admin):
    owner, owner_h = _user(client, admin, "g-owner@example.org", "Group Owner")
    bob, bob_h = _user(client, admin, "g-bob@example.org", "Bob")
    carol, carol_h = _user(client, admin, "g-carol@example.org", "Carol")
    g = _group(client, admin, "Test cooperative")
    gid = g["id"]

    # platform admin adds the group admin; the group admin adds others by email
    assert client.post(f"/api/groups/{gid}/members", headers=admin,
                       json={"user_id": owner["id"], "role": "admin"}).status_code == 201
    assert client.post(f"/api/groups/{gid}/members", headers=owner_h,
                       json={"email": "G-BOB@example.org"}).status_code == 201
    assert client.post(f"/api/groups/{gid}/members", headers=owner_h,
                       json={"email": "g-carol@example.org"}).status_code == 201
    assert _members(client, owner_h, gid) == {owner["id"]: "admin", bob["id"]: "member", carol["id"]: "member"}

    # plain members can't manage, but can see members
    assert client.post(f"/api/groups/{gid}/members", headers=bob_h,
                       json={"email": "admin@foodchainiq.local"}).status_code == 403
    assert client.delete(f"/api/groups/{gid}/members/{carol['id']}", headers=bob_h).status_code == 403
    assert client.patch(f"/api/groups/{gid}", headers=bob_h, json={"name": "Hijacked"}).status_code == 403

    # group admin renames, promotes, demotes
    r = client.patch(f"/api/groups/{gid}", headers=owner_h, json={"name": "Test co-op", "description": "New"})
    assert r.status_code == 200 and r.json()["name"] == "Test co-op"
    r = client.patch(f"/api/groups/{gid}/members/{bob['id']}", headers=owner_h, json={"role": "admin"})
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert client.patch(f"/api/groups/{gid}/members/{bob['id']}", headers=owner_h,
                        json={"role": "member"}).status_code == 200

    # the last group admin can't leave or demote themselves
    r = client.delete(f"/api/groups/{gid}/members/{owner['id']}", headers=owner_h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "last_group_admin"
    assert client.patch(f"/api/groups/{gid}/members/{owner['id']}", headers=owner_h,
                        json={"role": "member"}).status_code == 409

    # a member leaves; the group admin removes another
    assert client.delete(f"/api/groups/{gid}/members/{carol['id']}", headers=carol_h).status_code == 204
    assert client.delete(f"/api/groups/{gid}/members/{bob['id']}", headers=owner_h).status_code == 204
    assert _members(client, owner_h, gid) == {owner["id"]: "admin"}
    # a non-member no longer sees the group
    assert client.get(f"/api/groups/{gid}/members", headers=carol_h).status_code == 404


def test_pending_users_cannot_join_groups(client, admin):
    client.post("/api/auth/register", json={"email": "pending-join@example.org", "display_name": "P",
                                            "password": "pending1234"})
    pending = client.get("/api/admin/users?q=pending-join", headers=admin).json()["items"][0]
    g = _group(client, admin, "Pending test group")
    r = client.post(f"/api/groups/{g['id']}/members", headers=admin, json={"user_id": pending["id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "user_not_active"


def test_admin_edits_users(client, admin):
    u, _ = _user(client, admin, "edit-me@example.org", "Edit Me")
    r = client.patch(f"/api/admin/users/{u['id']}", headers=admin,
                     json={"display_name": "Edited", "email": "Edited@Example.org", "organization": "VK",
                           "role": "admin", "quota_bytes": 1024})
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["display_name"], body["email"], body["organization"], body["role"]) == \
        ("Edited", "edited@example.org", "VK", "admin")
    assert body["storage"]["quota_bytes"] == 1024
    # email clash
    clash = client.patch(f"/api/admin/users/{u['id']}", headers=admin, json={"email": "g-bob@example.org"})
    assert clash.status_code == 409
    # search
    found = client.get("/api/admin/users?q=edited", headers=admin).json()["items"]
    assert [x["id"] for x in found] == [u["id"]]
    # disabling signs the user out and blocks sign-in; password reset works
    assert client.patch(f"/api/admin/users/{u['id']}", headers=admin, json={"disabled": True}).status_code == 200
    r = client.post("/api/auth/login", json={"email": "edited@example.org", "password": "testperson1"})
    assert r.status_code == 401
    assert client.patch(f"/api/admin/users/{u['id']}", headers=admin,
                        json={"disabled": False, "password": "brandnew123"}).status_code == 200
    login(client, "edited@example.org", "brandnew123")


def test_admin_cannot_lock_themselves_out(client, admin):
    me = client.get("/api/auth/me", headers=admin).json()
    for patch in ({"role": "user"}, {"disabled": True}):
        r = client.patch(f"/api/admin/users/{me['id']}", headers=admin, json=patch)
        assert r.status_code == 409 and r.json()["error"]["code"] == "self_lockout"
    assert client.delete(f"/api/admin/users/{me['id']}", headers=admin).status_code == 409
    # non-admins can't manage users
    planner = login(client, "planner@foodchainiq.local", "planner1234")
    assert client.get("/api/admin/users", headers=planner).status_code == 403
    assert client.delete(f"/api/admin/users/{me['id']}", headers=planner).status_code == 403


def test_delete_user_transfers_datasets(client, admin):
    import io
    import json

    from test_api import _meta, STORES_CSV

    leaver, leaver_h = _user(client, admin, "leaver@example.org", "Leaver")
    heir, heir_h = _user(client, admin, "heir@example.org", "Heir")
    g = _group(client, admin, "Leaver group")
    client.post(f"/api/groups/{g['id']}/members", headers=admin, json={"user_id": leaver["id"]})
    files = [("metadata", ("metadata.json", json.dumps(_meta(title="Leaver data")), "application/json")),
             ("files", ("stores.csv", io.BytesIO(STORES_CSV.encode()), "text/csv"))]
    ds = client.post("/api/datasets", headers=leaver_h, files=files, data={"visibility": "private"}).json()

    r = client.delete(f"/api/admin/users/{leaver['id']}", headers=admin)
    assert r.status_code == 409 and r.json()["error"]["code"] == "user_has_datasets"
    r = client.delete(f"/api/admin/users/{leaver['id']}?transfer_to={heir['id']}", headers=admin)
    assert r.status_code == 204
    assert client.get(f"/api/datasets/{ds['id']}", headers=heir_h).json()["owner"]["id"] == heir["id"]
    assert client.post("/api/auth/login", json={"email": "leaver@example.org",
                                                "password": "testperson1"}).status_code == 401
    assert leaver["id"] not in _members(client, admin, g["id"])
    log = client.get("/api/admin/audit-log?action=user.delete", headers=admin).json()["items"]
    assert any(e["target"]["email"] == "leaver@example.org" for e in log)

    # a user without datasets is deleted directly
    gone, _ = _user(client, admin, "gone@example.org", "Gone")
    assert client.delete(f"/api/admin/users/{gone['id']}", headers=admin).status_code == 204


def test_delete_group_makes_shared_datasets_private(client, admin):
    import io
    import json

    from test_api import _meta, STORES_CSV

    owner, owner_h = _user(client, admin, "grp-del@example.org", "Group Deleter")
    g = _group(client, admin, "Doomed group")
    client.post(f"/api/groups/{g['id']}/members", headers=admin, json={"user_id": owner["id"]})
    files = [("metadata", ("metadata.json", json.dumps(_meta(title="Group data")), "application/json")),
             ("files", ("stores.csv", io.BytesIO(STORES_CSV.encode()), "text/csv"))]
    ds = client.post("/api/datasets", headers=owner_h, files=files,
                     data={"visibility": "group", "group_id": g["id"]}).json()
    assert ds["visibility"] == "group"

    planner = login(client, "planner@foodchainiq.local", "planner1234")
    assert client.delete(f"/api/admin/groups/{g['id']}", headers=planner).status_code == 403
    assert client.delete(f"/api/admin/groups/{g['id']}", headers=admin).status_code == 204
    after = client.get(f"/api/datasets/{ds['id']}", headers=owner_h).json()
    assert after["visibility"] == "private" and after.get("group") is None
    assert g["id"] not in {x["id"] for x in client.get("/api/groups", headers=admin).json()["items"]}
