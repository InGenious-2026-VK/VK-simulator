"""End-to-end API tests: Home → Data Lake → Visualization → Simulation."""

import io
import json
from pathlib import Path

from conftest import login

REPO = Path(__file__).resolve().parents[2]


def _meta(**over):
    m = {
        "schema_version": "1.0",
        "title": "Test cold stores",
        "description": "Two new cold stores used in the tests.",
        "category": "processing",
        "source": {"organization": "Test"},
        "license": "CC0-1.0",
        "sensitivity": "open",
        "files": [{"name": "stores.csv", "format": "csv"}],
        "simulation": {"role": "processing",
                       "mapping": {"file": "stores.csv", "id": "sid", "capacity_tpd": "cap"}},
    }
    m.update(over)
    return m


STORES_CSV = "sid,name,type,lat,lon,cap\nnew-cold-1,Kisa cold store,cold storage,57.99,15.63,40\nnew-cold-2,Ydre store,storage,57.82,15.27,25\n"


def _upload(client, headers, meta=None, files=None, visibility="private", group_id=None):
    parts = []
    if meta is not False:
        parts.append(("metadata", ("metadata.json", json.dumps(meta or _meta()), "application/json")))
    for name, body in (files if files is not None else {"stores.csv": STORES_CSV}).items():
        parts.append(("files", (name, io.BytesIO(body.encode()), "text/csv")))
    data = {"visibility": visibility}
    if group_id:
        data["group_id"] = group_id
    return client.post("/api/datasets", headers=headers, files=parts, data=data)


# ---------------------------------------------------------------- Window 1


def test_health_and_public_stats_need_no_auth(client):
    assert client.get("/api/health").json()["status"] == "ok"
    stats = client.get("/api/stats/public").json()
    assert stats["public_datasets"] >= 2


def test_login_me_refresh_logout(client):
    r = client.post("/api/auth/login", json={"email": "PLANNER@foodchainiq.local", "password": "planner1234"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "Bearer" and body["user"]["role"] == "user"
    assert "fciq_refresh" in r.cookies
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["email"] == "planner@foodchainiq.local"
    assert {g["name"] for g in me.json()["groups"]} >= {"Länsstyrelsen Östergötland"}

    r2 = client.post("/api/auth/refresh")
    assert r2.status_code == 200 and r2.json()["access_token"]
    assert client.post("/api/auth/logout").status_code == 204
    assert client.post("/api/auth/refresh").status_code == 401


def test_bad_login_and_rate_limit(client):
    for _ in range(5):
        r = client.post("/api/auth/login", json={"email": "nobody@x.se", "password": "nope"})
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "invalid_credentials"
    r = client.post("/api/auth/login", json={"email": "nobody@x.se", "password": "nope"})
    assert r.status_code == 429


def test_data_lake_requires_auth(client):
    r = client.get("/api/datasets")
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthenticated"


# ---------------------------------------------------------------- Window 2


def test_visibility_rules(client, planner, producer, admin):
    mine = client.get("/api/datasets?scope=mine", headers=planner).json()["items"]
    private = next(d for d in mine if d["visibility"] == "private")
    # producer is not in Länsstyrelsen and doesn't own the private one
    seen = {d["id"] for d in client.get("/api/datasets", headers=producer).json()["items"]}
    assert private["id"] not in seen
    assert client.get(f"/api/datasets/{private['id']}", headers=producer).status_code == 404
    assert client.get(f"/api/datasets/{private['id']}", headers=admin).status_code == 200
    # producer sees its own group dataset and the public ones
    public = client.get("/api/datasets?scope=public", headers=producer).json()
    assert public["total"] == 2 and all(d["visibility"] == "public" for d in public["items"])


def test_list_filters_search_and_paging(client, planner):
    r = client.get("/api/datasets?q=corridor", headers=planner).json()
    assert [d["category"] for d in r["items"]] == ["logistics"]
    r = client.get("/api/datasets?format=geojson&category=production", headers=planner).json()
    assert r["total"] == 1
    r = client.get("/api/datasets?page_size=2&sort=title", headers=planner).json()
    assert len(r["items"]) == 2 and r["total"] >= 5
    assert r["items"][0]["title"] <= r["items"][1]["title"]


def test_upload_validation(client, planner):
    r = _upload(client, planner, meta=False)
    assert r.status_code == 400 and r.json()["error"]["code"] == "metadata_missing"

    bad = _meta()
    del bad["license"]
    r = _upload(client, planner, meta=bad)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_metadata"
    assert {"path": "/license", "message": "is required"} in r.json()["error"]["details"]["errors"]

    r = _upload(client, planner, files={"other.csv": STORES_CSV})
    assert r.status_code == 400 and r.json()["error"]["code"] == "file_mismatch"

    r = _upload(client, planner, meta=_meta(sensitivity="restricted"), visibility="public")
    assert r.status_code == 403 and r.json()["error"]["code"] == "visibility_not_allowed"

    r = _upload(client, planner, visibility="group", group_id="grp_doesnotexist")
    assert r.status_code == 403

    m = _meta(files=[{"name": "x.exe", "format": "csv"}])
    m["simulation"]["mapping"]["file"] = "x.exe"
    r = _upload(client, planner, meta=m, files={"x.exe": "a"})
    assert r.status_code == 415


def test_metadata_template_and_validate(client, planner):
    tpl = client.get("/api/metadata/template", headers=planner).json()
    assert client.post("/api/metadata/validate", headers=planner, json=tpl).json() == {"valid": True, "errors": []}
    example = json.loads((REPO / "documentation/api/examples/metadata.example.json").read_text())
    assert client.post("/api/metadata/validate", headers=planner, json=example).json()["valid"]
    r = client.post("/api/metadata/validate", headers=planner, json={"title": "x"}).json()
    assert not r["valid"] and r["errors"]


def test_schema_copy_matches_docs():
    a = (REPO / "documentation/api/dataset-metadata.schema.json").read_text()
    b = (REPO / "backend/app/schemas/dataset-metadata.schema.json").read_text()
    assert json.loads(a) == json.loads(b)


def test_upload_ingest_preview_patch_and_version(client, planner, producer):
    r = _upload(client, planner)
    assert r.status_code == 202, r.text
    assert r.headers["location"].startswith("/api/datasets/ds_")
    ds_id = r.json()["id"]

    d = client.get(f"/api/datasets/{ds_id}", headers=planner).json()
    assert d["status"] == "ready"
    assert d["files"][0]["record_count"] == 2
    assert d["spatial"]["has_geometry"] and d["spatial"]["bbox"]
    cols = {c["name"]: c for c in d["files"][0]["columns"]}
    assert cols["cap"]["type"] == "integer" and cols["cap"]["max"] == 40

    p = client.get(f"/api/datasets/{ds_id}/preview", headers=planner).json()
    assert p["columns"][0] == "sid" and len(p["rows"]) == 2

    geo = client.get(f"/api/datasets/{ds_id}/geometry", headers=planner)
    assert geo.headers["content-type"].startswith("application/geo+json")
    assert len(geo.json()["features"]) == 2

    f = d["files"][0]
    dl = client.get(f"/api/datasets/{ds_id}/files/{f['id']}", headers=planner)
    assert dl.status_code == 200 and dl.text == STORES_CSV

    # private -> public; producer can now see it
    assert client.get(f"/api/datasets/{ds_id}", headers=producer).status_code == 404
    r = client.patch(f"/api/datasets/{ds_id}", headers=planner, json={"visibility": "public", "title": "Cold stores"})
    assert r.status_code == 200 and r.json()["visibility"] == "public"
    assert client.get(f"/api/datasets/{ds_id}", headers=producer).status_code == 200
    assert client.patch(f"/api/datasets/{ds_id}", headers=producer, json={"title": "hijack"}).status_code == 403

    # new version
    parts = [("metadata", ("metadata.json", json.dumps(_meta()), "application/json")),
             ("files", ("stores.csv", io.BytesIO((STORES_CSV + "new-cold-3,Third,storage,58.1,15.9,10\n").encode()), "text/csv"))]
    r = client.put(f"/api/datasets/{ds_id}/files", headers=planner, files=parts)
    assert r.status_code == 202 and r.json()["version"] == 2
    d = client.get(f"/api/datasets/{ds_id}", headers=planner).json()
    assert d["files"][0]["record_count"] == 3


def test_removal_request_flow(client, planner, producer, admin):
    ds_id = _upload(client, planner, meta=_meta(title="To be removed")).json()["id"]
    assert client.post(f"/api/datasets/{ds_id}/removal-requests", headers=producer,
                       json={"reason": "not mine"}).status_code == 404
    r = client.post(f"/api/datasets/{ds_id}/removal-requests", headers=planner, json={"reason": "Superseded data"})
    assert r.status_code == 201 and r.json()["status"] == "pending"
    rr_id = r.json()["id"]
    again = client.post(f"/api/datasets/{ds_id}/removal-requests", headers=planner, json={"reason": "Superseded data"})
    assert again.status_code == 409
    assert client.get(f"/api/datasets/{ds_id}", headers=planner).json()["removal_request"]["status"] == "pending"

    # cancel, re-request, admin rejects, re-request, admin approves
    assert client.post(f"/api/removal-requests/{rr_id}/cancel", headers=planner).json()["status"] == "cancelled"
    rr_id = client.post(f"/api/datasets/{ds_id}/removal-requests", headers=planner, json={"reason": "Again please"}).json()["id"]
    assert client.post(f"/api/admin/removal-requests/{rr_id}/decision", headers=planner,
                       json={"decision": "approve"}).status_code == 403
    queue = client.get("/api/admin/removal-requests", headers=admin).json()
    assert any(x["id"] == rr_id for x in queue["items"])
    r = client.post(f"/api/admin/removal-requests/{rr_id}/decision", headers=admin,
                    json={"decision": "approve", "note": "ok"})
    assert r.json()["status"] == "approved"
    assert client.get(f"/api/datasets/{ds_id}", headers=planner).status_code == 404
    mine = client.get("/api/removal-requests", headers=planner).json()["items"]
    assert {x["status"] for x in mine} >= {"approved", "cancelled"}

    log = client.get(f"/api/admin/audit-log?dataset_id={ds_id}", headers=admin).json()["items"]
    assert {"dataset.upload", "removal.request", "removal.decision"} <= {e["action"] for e in log}


def test_groups(client, planner, producer):
    groups = client.get("/api/groups", headers=producer).json()["items"]
    vk = next(g for g in groups if g["name"] == "Vreta Kluster producers")
    assert vk["role"] == "admin"
    members = client.get(f"/api/groups/{vk['id']}/members", headers=producer).json()["items"]
    assert len(members) == 2
    # planner is a plain member: cannot manage
    assert client.delete(f"/api/groups/{vk['id']}/members/whatever", headers=planner).status_code == 403


# ---------------------------------------------------------------- Windows 3 + 4


def _selection(client, headers, ids):
    r = client.post("/api/selections", headers=headers, json={"dataset_ids": ids})
    assert r.status_code == 201, r.text
    return r.json()


def test_selection_summary_and_simulation(client, planner):
    items = client.get("/api/datasets?status=ready&page_size=100", headers=planner).json()["items"]
    seeded = [d["id"] for d in items if "synthetic" in d["title"]]
    assert len(seeded) == 5
    sel = _selection(client, planner, seeded)
    assert len(sel["datasets"]) == 5 and sel["unavailable"] == []
    assert client.get(f"/api/selections/{sel['id']}", headers=planner).json()["id"] == sel["id"]

    s = client.get(f"/api/visualizations/summary?selection_id={sel['id']}", headers=planner).json()
    assert s["overview"]["dataset_count"] == 5
    assert s["overview"]["municipalities_covered"] > 0
    assert all(v.startswith("dataset:") for v in s["simulation_readiness"].values())
    kinds = {c["kind"] for d in s["datasets"] for c in d["charts"]}
    assert {"timeseries", "point_map", "bar"} <= kinds

    ctx = client.get(f"/api/simulation/context?selection_id={sel['id']}", headers=planner).json()
    assert ctx["inputs"]["production"]["nodes_replaced"] == 9
    assert ctx["inputs"]["logistics"]["edges_replaced"] > 0
    assert len(ctx["map_layers"]) == 5

    scenario = {"duration_days": 7, "disruptions": [{"kind": "fuel_shortage", "factor": 0.5}]}
    base = client.post("/api/simulate", json=scenario).json()
    assert base["run_id"] is None  # anonymous baseline runs are not stored
    run = client.post("/api/simulate", headers=planner, json={**scenario, "selection_id": sel["id"]}).json()
    assert run["run_id"].startswith("run_")
    assert len(run["inputs"]["datasets"]) == 5
    # the dry-summer production dataset (-10%) can only make things worse
    assert run["region_summary"]["scenario_met_tpd"] <= base["region_summary"]["scenario_met_tpd"]

    hist = client.get("/api/simulations", headers=planner).json()
    assert hist["items"][0]["run_id"] == run["run_id"]
    assert client.get(f"/api/simulations/{run['run_id']}", headers=planner).json()["result"]["region_summary"]


def test_new_nodes_are_added_and_snapped(client, planner):
    ds_id = _upload(client, planner, meta=_meta(title="Snap test stores"), visibility="private").json()["id"]
    sel = _selection(client, planner, [ds_id])
    ctx = client.get(f"/api/simulation/context?selection_id={sel['id']}", headers=planner).json()
    assert ctx["inputs"]["processing"]["nodes_added"] == 2
    net = client.get(f"/api/network?selection_id={sel['id']}", headers=planner).json()
    new = [n for n in net["nodes"] if n["id"] == "new-cold-1"]
    assert new and new[0]["type"] == "storage" and new[0]["source"] == ds_id
    assert any(e["target"] == "new-cold-1" for e in net["edges"])
    r = client.post("/api/simulate", headers=planner,
                    json={"selection_id": sel["id"], "disruptions": [{"kind": "node_outage", "node_id": "new-cold-1"}]})
    assert r.status_code == 200


def test_selection_rules(client, planner, producer):
    mine = client.get("/api/datasets?scope=mine", headers=planner).json()["items"]
    private = next(d["id"] for d in mine if d["visibility"] == "private")
    # producer can't select a dataset it can't see
    r = client.post("/api/selections", headers=producer, json={"dataset_ids": [private]})
    assert r.status_code == 404
    sel = _selection(client, planner, [private])
    # opening someone else's selection drops what you can't see
    other = client.get(f"/api/selections/{sel['id']}", headers=producer).json()
    assert other["datasets"] == [] and other["unavailable"][0]["reason"] == "access_revoked"
    assert client.get(f"/api/network?selection_id={sel['id']}").status_code == 401


def test_baseline_endpoints_stay_public(client):
    assert len(client.get("/api/network").json()["nodes"]) > 10
    assert client.get("/api/presets").json()
