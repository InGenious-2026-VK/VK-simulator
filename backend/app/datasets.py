"""Dataset storage, ingestion and serialisation (shared by the routers)."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import ingest
from .access import group_ids, group_role
from .config import settings
from .db import SessionLocal
from .errors import ApiError
from .metadata import parse_metadata
from .orm import Dataset, DatasetFile, DatasetVersion, RemovalRequest, User, now

CHUNK = 1024 * 1024


def storage_root() -> Path:
    return settings.storage_dir / "datasets"


def version_dir(dataset_id: str, version: int) -> Path:
    return storage_root() / dataset_id / f"v{version}"


# ---------------------------------------------------------------- upload checks


def check_visibility(db: Session, user: User, visibility: str, group_id: str | None,
                     sensitivity: str) -> str | None:
    if visibility not in {"private", "group", "public"}:
        raise ApiError(400, "validation_error", "visibility must be private, group or public.")
    if visibility == "public" and sensitivity == "restricted":
        raise ApiError(403, "visibility_not_allowed",
                       "Datasets with sensitivity 'restricted' cannot be public.")
    if visibility == "group":
        if not group_id:
            raise ApiError(400, "validation_error", "group_id is required when visibility is group.")
        if user.role != "admin" and group_role(db, user, group_id) is None:
            raise ApiError(403, "visibility_not_allowed", "You are not a member of that group.")
        return group_id
    return None


async def read_metadata_upload(metadata: list[UploadFile] | UploadFile | None) -> dict:
    parts = metadata if isinstance(metadata, list) else [metadata] if metadata else []
    if len(parts) != 1:
        raise ApiError(400, "metadata_missing",
                       "Exactly one metadata file is required with every upload.",
                       {"received": len(parts)})
    meta, errors = parse_metadata(await parts[0].read())
    if errors:
        raise ApiError(400, "invalid_metadata", "The metadata file is invalid.", {"errors": errors})
    return meta


def check_files_against_metadata(meta: dict, files: list[UploadFile]) -> dict[str, dict]:
    if not files:
        raise ApiError(400, "validation_error", "At least one data file is required.")
    if len(files) > settings.max_files_per_dataset:
        raise ApiError(400, "validation_error",
                       f"At most {settings.max_files_per_dataset} files per dataset.")
    declared = {f["name"]: f for f in meta["files"]}
    uploaded = [Path(f.filename or "").name for f in files]
    if len(uploaded) != len(set(uploaded)):
        raise ApiError(400, "file_mismatch", "Two uploaded files have the same name.")
    missing = sorted(set(declared) - set(uploaded))
    extra = sorted(set(uploaded) - set(declared))
    if missing or extra:
        raise ApiError(400, "file_mismatch",
                       "Uploaded files must match metadata.files exactly.",
                       {"missing_from_upload": missing, "not_in_metadata": extra})
    for name in uploaded:
        if ingest.format_from_name(name) is None:
            raise ApiError(415, "unsupported_format", f"{name}: unsupported file type.",
                           {"file": name})
    return declared


def used_bytes(db: Session, user: User) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(Dataset.size_bytes), 0)).where(
            Dataset.owner_id == user.id, Dataset.removed_at.is_(None)
        )
    ) or 0)


async def save_files(dest: Path, files: list[UploadFile], budget: int) -> dict[str, int]:
    """Stream uploads to disk; abort with 413 when over `budget` bytes."""
    dest.mkdir(parents=True, exist_ok=True)
    sizes: dict[str, int] = {}
    total = 0
    try:
        for f in files:
            name = Path(f.filename or "").name
            size = 0
            with open(dest / name, "wb") as out:
                while chunk := await f.read(CHUNK):
                    size += len(chunk)
                    total += len(chunk)
                    if total > budget:
                        raise ApiError(413, "upload_too_large",
                                       "The upload exceeds the size limit or your storage quota.")
                    out.write(chunk)
            sizes[name] = size
    except BaseException:
        shutil.rmtree(dest, ignore_errors=True)
        raise
    return sizes


def upload_budget(db: Session, user: User) -> int:
    quota_left = user.quota_bytes - used_bytes(db, user)
    if quota_left <= 0:
        raise ApiError(413, "quota_exceeded", "Your storage quota is full.")
    return min(settings.max_upload_bytes, quota_left)


def create_version(db: Session, ds: Dataset, version: int, meta: dict,
                   declared: dict[str, dict], sizes: dict[str, int]) -> DatasetVersion:
    vrow = DatasetVersion(dataset_id=ds.id, version=version, meta=meta)
    for name, size in sizes.items():
        vrow.files.append(DatasetFile(
            name=name,
            format=declared[name]["format"],
            size_bytes=size,
            storage_path=str(version_dir(ds.id, version) / name),
        ))
    ds.versions.append(vrow)
    ds.size_bytes = sum(sizes.values())
    return vrow


def apply_meta(ds: Dataset, meta: dict) -> None:
    ds.title = meta["title"]
    ds.description = meta["description"]
    ds.category = meta["category"]
    ds.keywords = meta.get("keywords", [])
    ds.sensitivity = meta["sensitivity"]
    ds.license = meta["license"]


# ---------------------------------------------------------------- ingestion


def ingest_version(dataset_id: str, version: int) -> None:
    """Profile every file of a version; set status ready / invalid. Own session."""
    db = SessionLocal()
    try:
        ds = db.get(Dataset, dataset_id)
        if ds is None:
            return
        vrow = ds.version_row(version)
        try:
            summary = _profile_version(ds, vrow)
            vrow.summary = ingest.clean_json(summary)
            if ds.version == version:
                ds.status = "ready"
                ds.status_reason = "; ".join(summary["notes"]) or None
        except Exception as exc:  # noqa: BLE001 — any parse failure marks it invalid
            if ds.version == version:
                ds.status = "invalid"
                ds.status_reason = str(exc)[:1000]
        ds.updated_at = now()
        db.commit()
    finally:
        db.close()


def _profile_version(ds: Dataset, vrow: DatasetVersion) -> dict:
    meta = vrow.meta
    file_meta = {f["name"]: f for f in meta["files"]}
    total, with_geom, boxes, charts, fields, notes, kinds = 0, 0, [], [], [], [], set()
    for f in vrow.files:
        fm = file_meta.get(f.name, {})
        try:
            table = ingest.read_table(Path(f.storage_path), f.format, fm)
        except Exception as exc:
            raise ValueError(f"{f.name}: could not be read ({exc})") from exc
        if table is None:
            notes.append(f"{f.name}: stored but not profiled ({f.format} is not readable here)")
            f.columns = [dict(c, profiled=False) for c in fm.get("columns", [])]
            continue
        cols = ingest.profile_columns(table, fm)
        f.columns = ingest.clean_json(cols)
        f.record_count = len(table.rows)
        total += len(table.rows)
        if table.geometries is not None:
            with_geom += sum(1 for g in table.geometries if g)
            boxes.append(ingest.bbox_of(table.geometries))
            kinds.add(ingest.geometry_kind(table.geometries))
        for c in cols:
            fields.append({**c, "file": f.name})
        charts.extend(ingest.charts_for(ds.id, f.id, f.name, table, cols))
    bbox = ingest.union_bbox(boxes) or (meta.get("spatial") or {}).get("bbox")
    return {
        "record_count": total,
        "features_with_geometry": with_geom,
        "has_geometry": with_geom > 0,
        "geometry_type": kinds.pop() if len(kinds) == 1 else ("mixed" if kinds else "none"),
        "bbox": bbox,
        "fields": fields,
        "charts": charts[:8],
        "notes": notes,
    }


# ---------------------------------------------------------------- serialisation


def user_ref(u: User | None) -> dict | None:
    return {"id": u.id, "display_name": u.display_name} if u else None


def _pending_removal(db: Session, ds: Dataset) -> RemovalRequest | None:
    return db.scalar(
        select(RemovalRequest).where(
            RemovalRequest.dataset_id == ds.id, RemovalRequest.status == "pending"
        )
    )


def serialize_dataset(db: Session, ds: Dataset, user: User, detail: bool = False,
                      groups: set[str] | None = None) -> dict[str, Any]:
    vrow = ds.version_row()
    meta = vrow.meta if vrow else {}
    summary = (vrow.summary or {}) if vrow else {}
    rr = _pending_removal(db, ds)
    is_owner = ds.owner_id == user.id
    files = []
    for f in vrow.files if vrow else []:
        item = {"id": f.id, "name": f.name, "format": f.format, "size_bytes": f.size_bytes,
                "record_count": f.record_count}
        if detail:
            item["columns"] = f.columns or []
        files.append(item)
    out = {
        "id": ds.id,
        "version": ds.version,
        "title": ds.title,
        "description": ds.description,
        "category": ds.category,
        "keywords": ds.keywords or [],
        "owner": user_ref(ds.owner),
        "visibility": ds.visibility,
        "group": {"id": ds.group.id, "name": ds.group.name} if ds.group else None,
        "status": "removed" if ds.removed_at else ds.status,
        "status_reason": ds.status_reason,
        "sensitivity": ds.sensitivity,
        "license": ds.license,
        "files": files,
        "spatial": {
            "crs": (meta.get("spatial") or {}).get("crs", "EPSG:4326"),
            "bbox": summary.get("bbox") or (meta.get("spatial") or {}).get("bbox"),
            "has_geometry": bool(summary.get("has_geometry")),
        },
        "temporal": meta.get("temporal"),
        "simulation": {"role": (meta.get("simulation") or {}).get("role")}
        if meta.get("simulation") else None,
        "removal_request": {"id": rr.id, "status": rr.status} if rr else None,
        "size_bytes": ds.size_bytes,
        "created_at": ds.created_at,
        "updated_at": ds.updated_at,
        "permissions": {
            "can_edit": is_owner or user.role == "admin",
            "can_request_removal": is_owner and rr is None,
            "can_download": True,
        },
    }
    if detail:
        out["metadata"] = meta
        out["source"] = meta.get("source")
        out["contact"] = meta.get("contact")
        out["record_count"] = summary.get("record_count")
    return out


def serialize_removal(rr: RemovalRequest) -> dict:
    return {
        "id": rr.id,
        "dataset": {"id": rr.dataset.id, "title": rr.dataset.title},
        "requested_by": user_ref(rr.requested_by),
        "reason": rr.reason,
        "status": rr.status,
        "decided_by": user_ref(rr.decided_by),
        "decision_note": rr.decision_note,
        "created_at": rr.created_at,
        "decided_at": rr.decided_at,
    }


def serialize_user(db: Session, u: User, with_storage: bool = True) -> dict:
    groups = [
        {"id": m.group.id, "name": m.group.name, "role": m.role}
        for m in sorted(u.memberships, key=lambda m: m.group.name)
    ]
    out = {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "role": u.role,
        "groups": groups,
        "disabled": u.disabled,
        "status": u.status,
    }
    if with_storage:
        out["storage"] = {"used_bytes": used_bytes(db, u), "quota_bytes": u.quota_bytes}
    return out


__all__ = ["group_ids"]
