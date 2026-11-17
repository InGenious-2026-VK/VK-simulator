"""Selections (Data Lake → Visualization → Simulation) and the selection summary."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import ingest
from ..access import can_see, get_visible, group_ids
from ..config import settings
from ..db import get_db
from ..errors import ApiError, not_found
from ..merge import INPUT_ROLES
from ..orm import Dataset, Selection, User, now
from ..security import current_user
from .datasets import dataset_summary

router = APIRouter(tags=["Selections"])


class SelectionBody(BaseModel):
    dataset_ids: list[str] = Field(min_length=1)


def resolve(db: Session, user: User, sel: Selection) -> tuple[list[tuple[Dataset, int]], list[dict]]:
    """Datasets of a selection the caller can still see, plus the unavailable ones."""
    groups = group_ids(db, user)
    ok, gone = [], []
    for item in sel.items:
        ds = db.get(Dataset, item["id"])
        if ds is None or ds.removed_at is not None:
            gone.append({"id": item["id"], "title": ds.title if ds else None, "reason": "removed"})
        elif not can_see(db, user, ds, groups):
            gone.append({"id": item["id"], "title": None, "reason": "access_revoked"})
        else:
            ok.append((ds, item["version"]))
    return ok, gone


def serialize_selection(db: Session, user: User, sel: Selection) -> dict:
    ok, gone = resolve(db, user, sel)
    return {
        "id": sel.id,
        "datasets": [
            {"id": ds.id, "version": v, "title": ds.title, "category": ds.category,
             "simulation_role": ((ds.version_row(v).meta.get("simulation") or {}).get("role")
                                 if ds.version_row(v) else None),
             "visibility": ds.visibility}
            for ds, v in ok
        ],
        "unavailable": gone,
        "created_by": sel.created_by_id,
        "created_at": sel.created_at,
        "expires_at": sel.expires_at,
    }


def load_selection(db: Session, user: User, selection_id: str) -> Selection:
    sel = db.get(Selection, selection_id)
    if sel is None:
        raise not_found("selection", selection_id)
    exp = sel.expires_at if sel.expires_at.tzinfo else sel.expires_at.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise ApiError(404, "selection_expired", "This selection has expired. Select datasets again.")
    return sel


@router.post("/selections", status_code=201)
def create_selection(body: SelectionBody, user: User = Depends(current_user),
                     db: Session = Depends(get_db)) -> dict:
    ids = list(dict.fromkeys(body.dataset_ids))
    if len(ids) > settings.max_selection_size:
        raise ApiError(400, "validation_error",
                       f"At most {settings.max_selection_size} datasets per selection.")
    items = []
    for did in ids:
        ds = get_visible(db, user, did)
        if ds.status != "ready":
            raise ApiError(409, "dataset_not_ready", f"Dataset {ds.title!r} is {ds.status}.",
                           {"dataset_id": ds.id})
        items.append({"id": ds.id, "version": ds.version})
    sel = Selection(created_by_id=user.id, items=items,
                    expires_at=now() + timedelta(days=settings.selection_ttl_days))
    db.add(sel)
    db.commit()
    return serialize_selection(db, user, sel)


@router.get("/selections/{selection_id}")
def get_selection(selection_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return serialize_selection(db, user, load_selection(db, user, selection_id))


# ---------------------------------------------------------------- Window 3


def _cross_checks(summaries: list[dict]) -> list[dict]:
    checks = []
    roles: dict[str, list[str]] = {}
    for s in summaries:
        r = s.get("simulation_role")
        if r and r != "reference":
            roles.setdefault("population" if r == "demand" else r, []).append(s["title"])
        if not s.get("bbox"):
            checks.append({"level": "info", "code": "no_geometry",
                           "message": f"{s['title']} has no geometry and is used as tabular input only."})
        if s.get("notes"):
            checks.extend({"level": "info", "code": "not_profiled", "message": n} for n in s["notes"])
    for role, titles in roles.items():
        if len(titles) > 1:
            checks.append({"level": "warning", "code": "role_conflict",
                           "message": f"{len(titles)} datasets declare role '{role}': {', '.join(titles)}."})
    spans = [(s["temporal"]["start"], s["temporal"]["end"], s["title"]) for s in summaries
             if s.get("temporal") and s["temporal"].get("start") and s["temporal"].get("end")]
    if len(spans) > 1:
        start, end = max(a for a, _, _ in spans), min(b for _, b, _ in spans)
        if start > end:
            checks.append({"level": "warning", "code": "no_time_overlap",
                           "message": "The selected datasets' time ranges do not overlap."})
        else:
            checks.append({"level": "info", "code": "time_overlap",
                           "message": f"Time ranges overlap from {start} to {end}."})
    boxes = [s["bbox"] for s in summaries if s.get("bbox")]
    if len(boxes) > 1:
        x0, y0 = max(b[0] for b in boxes), max(b[1] for b in boxes)
        x1, y1 = min(b[2] for b in boxes), min(b[3] for b in boxes)
        if x0 > x1 or y0 > y1:
            checks.append({"level": "warning", "code": "no_spatial_overlap",
                           "message": "Some selected datasets cover areas that do not overlap."})
    return checks


@router.get("/visualizations/summary", tags=["Visualization"])
def selection_summary(selection_id: str, user: User = Depends(current_user),
                      db: Session = Depends(get_db)) -> dict:
    sel = load_selection(db, user, selection_id)
    ok, gone = resolve(db, user, sel)
    summaries = [dataset_summary(ds, v) for ds, v in ok]
    times = [s["temporal"] for s in summaries if s.get("temporal")]
    bbox = ingest.union_bbox(s.get("bbox") for s in summaries)
    readiness = {r: "baseline" for r in INPUT_ROLES}
    for s in summaries:
        r = s.get("simulation_role")
        key = "population" if r == "demand" else r
        if key in readiness and readiness[key] == "baseline":
            readiness[key] = f"dataset:{s['id']}"
    return {
        "selection_id": sel.id,
        "generated_at": now(),
        "unavailable": gone,
        "overview": {
            "dataset_count": len(summaries),
            "total_records": sum(s["record_count"] or 0 for s in summaries),
            "features_with_geometry": sum(s["features_with_geometry"] or 0 for s in summaries),
            "time_span": {
                "start": min((t["start"] for t in times if t.get("start")), default=None),
                "end": max((t["end"] for t in times if t.get("end")), default=None),
            },
            "combined_bbox": bbox,
            "municipalities_covered": len(ingest.municipalities_in(bbox)),
            "municipalities": ingest.municipalities_in(bbox),
        },
        "datasets": summaries,
        "cross_checks": _cross_checks(summaries),
        "simulation_readiness": readiness,
    }
