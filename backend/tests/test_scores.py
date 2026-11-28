"""Dataset quality scores (#33): usage score and user feedback score."""

import io
import json

from test_api import STORES_CSV, _meta, _selection, _upload

SCENARIO = {"duration_days": 3, "disruptions": [{"kind": "fuel_shortage", "factor": 0.5}]}


def _scores(client, headers, ds_id):
    r = client.get(f"/api/datasets/{ds_id}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["scores"]


def _run(client, headers, ids):
    sel = _selection(client, headers, ids)
    r = client.post("/api/simulate", headers=headers, json={**SCENARIO, "selection_id": sel["id"]})
    assert r.status_code == 200, r.text
    return r.json()["run_id"]


def _rate(client, headers, run_id, rating):
    return client.put(f"/api/simulations/{run_id}/feedback", headers=headers, json={"rating": rating})


def _public_dataset(client, headers, title, role="processing"):
    meta = _meta(title=title)
    if role == "reference":
        meta["simulation"] = {"role": "reference"}
    r = _upload(client, headers, meta=meta, visibility="public")
    assert r.status_code == 202, r.text
    return r.json()["id"]


def test_new_dataset_starts_at_zero(client, planner):
    ds = _public_dataset(client, planner, "Score start stores")
    s = _scores(client, planner, ds)
    assert s == {"version": 1, "usage": 0, "feedback": 0,
                 "ratings": {"up": 0, "meh": 0, "down": 0}}
    listed = client.get("/api/datasets?q=Score start stores", headers=planner).json()["items"]
    assert listed[0]["scores"]["usage"] == 0


def test_runs_count_and_ratings_add_up(client, planner, producer):
    ds = _public_dataset(client, planner, "Score rating stores")

    # the owner's own run counts, and so does another user's
    own = _run(client, planner, [ds])
    other = _run(client, producer, [ds])
    third = _run(client, producer, [ds])
    assert _scores(client, planner, ds)["usage"] == 3

    assert _rate(client, planner, own, "up").status_code == 200
    assert _rate(client, producer, other, "meh").status_code == 200
    assert _rate(client, producer, third, "down").status_code == 200
    s = _scores(client, planner, ds)
    assert s["ratings"] == {"up": 1, "meh": 1, "down": 1}
    assert s["feedback"] == 2 - 0.5 - 2

    # only the latest rating counts; null removes it
    assert _rate(client, producer, third, "up").json()["feedback"] == "up"
    assert _scores(client, planner, ds)["feedback"] == 2 - 0.5 + 2
    assert _rate(client, producer, other, None).json()["feedback"] is None
    assert _scores(client, planner, ds)["feedback"] == 4

    hist = client.get("/api/simulations", headers=producer).json()["items"]
    assert {h["run_id"]: h["feedback"] for h in hist}[third] == "up"


def test_feedback_applies_to_every_dataset_in_the_run(client, planner):
    a = _public_dataset(client, planner, "Score multi A")
    b = _public_dataset(client, planner, "Score multi B")
    run = _run(client, planner, [a, b])
    _rate(client, planner, run, "up")
    assert _scores(client, planner, a)["feedback"] == 2
    assert _scores(client, planner, b)["feedback"] == 2


def test_map_only_datasets_count_for_usage_not_feedback(client, planner):
    proc = _public_dataset(client, planner, "Score role processing")
    ref = _public_dataset(client, planner, "Score role reference", role="reference")
    run = _run(client, planner, [proc, ref])
    _rate(client, planner, run, "down")
    assert _scores(client, planner, ref)["usage"] == 1
    assert _scores(client, planner, ref)["feedback"] == 0
    assert _scores(client, planner, proc)["feedback"] == -2


def test_admin_runs_do_not_count(client, planner, admin):
    ds = _public_dataset(client, planner, "Score admin stores")
    run = _run(client, admin, [ds])
    assert _rate(client, admin, run, "up").status_code == 200
    assert _scores(client, planner, ds)["usage"] == 0
    assert _scores(client, planner, ds)["feedback"] == 0


def test_new_version_resets_displayed_scores(client, planner, producer):
    ds = _public_dataset(client, planner, "Score version stores")
    run = _run(client, producer, [ds])
    _rate(client, producer, run, "up")
    assert _scores(client, planner, ds)["usage"] == 1

    parts = [("metadata", ("metadata.json", json.dumps(_meta(title="Score version stores")), "application/json")),
             ("files", ("stores.csv", io.BytesIO(STORES_CSV.encode()), "text/csv"))]
    assert client.put(f"/api/datasets/{ds}/files", headers=planner, files=parts).status_code == 202
    s = _scores(client, planner, ds)
    assert s["version"] == 2 and s["usage"] == 0 and s["feedback"] == 0

    # version 1's scores are kept
    from app.db import SessionLocal
    from app.scores import version_scores
    with SessionLocal() as db:
        old = version_scores(db, ds, 1)
    assert old["usage"] == 1 and old["feedback"] == 2


def test_feedback_rules(client, planner, producer):
    ds = _public_dataset(client, planner, "Score rule stores")
    run = _run(client, planner, [ds])
    # someone else's run looks like it does not exist
    assert _rate(client, producer, run, "up").status_code == 404
    assert _rate(client, planner, "run_doesnotexist", "up").status_code == 404
    assert _rate(client, planner, run, "great").status_code == 422
    assert client.put(f"/api/simulations/{run}/feedback", json={"rating": "up"}).status_code == 401

    # a baseline-only run has no datasets to rate
    base = client.post("/api/simulate", headers=planner, json=SCENARIO).json()["run_id"]
    r = _rate(client, planner, base, "up")
    assert r.status_code == 422 and r.json()["error"]["code"] == "nothing_to_rate"
