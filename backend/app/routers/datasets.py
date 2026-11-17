"""Window 2 — Data Lake: list / upload / edit / version / download / preview,
plus the per-dataset summary + geometry used by Windows 3 and 4, and
removal requests."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import String, and_, cast, exists, or_, select
from sqlalchemy.orm import Session

from .. import ingest
from ..access import audit, get_visible, group_ids, visible_datasets
from ..datasets import (
    apply_meta,
    check_files_against_metadata,
    check_visibility,
    create_version,
    ingest_version,
    read_metadata_upload,
    save_files,
    serialize_dataset,
    serialize_removal,
    upload_budget,
    version_dir,
)
from ..db import get_db
from ..errors import ApiError, not_found
from ..orm import Dataset, DatasetFile, DatasetVersion, RemovalRequest, User, new_id, now
from ..security import current_user
from .common import page_params, paginate

router = APIRouter(tags=["Datasets"])

SORTS = {
    "updated_at": Dataset.updated_at.asc(),
    "-updated_at": Dataset.updated_at.desc(),
    "title": Dataset.title.asc(),
    "-title": Dataset.title.desc(),
    "size_bytes": Dataset.size_bytes.asc(),
    "-size_bytes": Dataset.size_bytes.desc(),
}


@router.get("/datasets")
def list_datasets(
    scope: Literal["all", "mine", "groups", "public"] = "all",
    q: Optional[str] = None,
    category: list[str] = Query(default=[]),
    format: list[str] = Query(default=[]),
    visibility: list[str] = Query(default=[]),
    group_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    status: Optional[str] = None,
    updated_after: Optional[str] = None,
    sort: str = "-updated_at",
    paging=Depends(page_params),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = visible_datasets(db, user)
    groups = group_ids(db, user)
    if scope == "mine":
        query = query.where(Dataset.owner_id == user.id)
    elif scope == "groups":
        query = query.where(Dataset.visibility == "group", Dataset.group_id.in_(groups or {""}))
    elif scope == "public":
        query = query.where(Dataset.visibility == "public")
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(Dataset.title.ilike(like), Dataset.description.ilike(like),
                                cast(Dataset.keywords, String).ilike(like)))
    if category:
        query = query.where(Dataset.category.in_(category))
    if visibility:
        query = query.where(Dataset.visibility.in_(visibility))
    if group_id:
        query = query.where(Dataset.group_id == group_id)
    if owner_id:
        query = query.where(Dataset.owner_id == owner_id)
    if status:
        query = query.where(Dataset.status == status)
    if updated_after:
        query = query.where(Dataset.updated_at >= updated_after)
    if format:
        query = query.where(exists().where(and_(
            DatasetVersion.dataset_id == Dataset.id,
            DatasetVersion.version == Dataset.version,
            DatasetFile.version_id == DatasetVersion.id,
            DatasetFile.format.in_(format),
        )))
    query = query.order_by(SORTS.get(sort, SORTS["-updated_at"]), Dataset.id)
    return paginate(db, query, paging, lambda d: serialize_dataset(db, d, user, groups=groups))


@router.post("/datasets", status_code=202)
async def upload_dataset(
    background: BackgroundTasks,
    response: Response,
    metadata: Optional[list[UploadFile]] = File(None),
    files: Optional[list[UploadFile]] = File(None),
    visibility: str = Form(...),
    group_id: Optional[str] = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    meta = await read_metadata_upload(metadata)
    gid = check_visibility(db, user, visibility, group_id, meta["sensitivity"])
    declared = check_files_against_metadata(meta, files or [])
    budget = upload_budget(db, user)

    ds = Dataset(id=new_id("ds"), owner_id=user.id, version=1, visibility=visibility,
                 group_id=gid, status="processing")
    apply_meta(ds, meta)
    sizes = await save_files(version_dir(ds.id, 1), files, budget)
    db.add(ds)
    create_version(db, ds, 1, meta, declared, sizes)
    audit(db, user, "dataset.upload", ds.id, title=ds.title, files=list(sizes))
    db.commit()
    background.add_task(ingest_version, ds.id, 1)
    response.headers["Location"] = f"/api/datasets/{ds.id}"
    db.refresh(ds)
    return serialize_dataset(db, ds, user)


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return serialize_dataset(db, get_visible(db, user, dataset_id), user, detail=True)


class DatasetPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    keywords: Optional[list[str]] = None
    visibility: Optional[Literal["private", "group", "public"]] = None
    group_id: Optional[str] = None


def _owned(db: Session, user: User, dataset_id: str) -> Dataset:
    ds = get_visible(db, user, dataset_id)
    if ds.owner_id != user.id and user.role != "admin":
        raise ApiError(403, "forbidden", "Only the owner can change this dataset.")
    return ds


@router.patch("/datasets/{dataset_id}")
def patch_dataset(dataset_id: str, body: DatasetPatch, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> dict:
    ds = _owned(db, user, dataset_id)
    fields = body.model_dump(exclude_unset=True)
    if "visibility" in fields or "group_id" in fields:
        vis = fields.get("visibility", ds.visibility)
        gid = fields.get("group_id", ds.group_id if vis == "group" else None)
        new_gid = check_visibility(db, user, vis, gid, ds.sensitivity)
        if vis != ds.visibility or new_gid != ds.group_id:
            audit(db, user, "dataset.visibility_change", ds.id,
                  before=ds.visibility, after=vis, group_id=new_gid)
        ds.visibility, ds.group_id = vis, new_gid
    for key in ("title", "description", "keywords"):
        if fields.get(key) is not None:
            setattr(ds, key, fields[key])
    ds.updated_at = now()
    audit(db, user, "dataset.update", ds.id, fields=sorted(fields))
    db.commit()
    db.refresh(ds)
    return serialize_dataset(db, ds, user, detail=True)


@router.put("/datasets/{dataset_id}/files", status_code=202)
async def new_version(
    dataset_id: str,
    background: BackgroundTasks,
    metadata: Optional[list[UploadFile]] = File(None),
    files: Optional[list[UploadFile]] = File(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ds = _owned(db, user, dataset_id)
    meta = await read_metadata_upload(metadata)
    if ds.visibility == "public" and meta["sensitivity"] == "restricted":
        raise ApiError(403, "visibility_not_allowed",
                       "A public dataset cannot become 'restricted'. Change visibility first.")
    declared = check_files_against_metadata(meta, files or [])
    budget = upload_budget(db, user) + ds.size_bytes
    version = ds.version + 1
    sizes = await save_files(version_dir(ds.id, version), files, budget)
    create_version(db, ds, version, meta, declared, sizes)
    apply_meta(ds, meta)
    ds.version = version
    ds.status = "processing"
    ds.status_reason = None
    ds.updated_at = now()
    audit(db, user, "dataset.update", ds.id, version=version)
    db.commit()
    background.add_task(ingest_version, ds.id, version)
    db.refresh(ds)
    return serialize_dataset(db, ds, user)


def _file(ds: Dataset, file_id: str | None) -> DatasetFile:
    vrow = ds.version_row()
    files = vrow.files if vrow else []
    if file_id:
        f = next((f for f in files if f.id == file_id), None)
        if f is None:
            raise not_found("file", file_id)
        return f
    if not files:
        raise not_found("file", "?")
    return next((f for f in files if f.format in ingest.PROFILED_FORMATS), files[0])


@router.get("/datasets/{dataset_id}/files/{file_id}")
def download_file(dataset_id: str, file_id: str, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    ds = get_visible(db, user, dataset_id)
    f = _file(ds, file_id)
    audit(db, user, "dataset.download", ds.id, file=f.name)
    db.commit()
    return FileResponse(f.storage_path, filename=f.name)


@router.get("/datasets/{dataset_id}/metadata")
def get_metadata(dataset_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return get_visible(db, user, dataset_id).version_row().meta


@router.get("/datasets/{dataset_id}/preview")
def preview(dataset_id: str, file_id: Optional[str] = None, limit: int = Query(20, ge=1, le=200),
            user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    ds = get_visible(db, user, dataset_id)
    f = _file(ds, file_id)
    fm = next((x for x in ds.version_row().meta["files"] if x["name"] == f.name), {})
    table = ingest.read_table(Path(f.storage_path), f.format, fm)
    if table is None:
        return {"file_id": f.id, "file": f.name, "columns": [], "rows": [], "truncated": False,
                "note": f"{f.format} files are stored but cannot be previewed."}
    rows = [[r.get(c) for c in table.columns] for r in table.rows[:limit]]
    return ingest.clean_json({"file_id": f.id, "file": f.name, "columns": table.columns,
                              "rows": rows, "truncated": len(table.rows) > limit})


def dataset_summary(ds: Dataset, version: int | None = None) -> dict:
    vrow = ds.version_row(version)
    s = (vrow.summary or {}) if vrow else {}
    sim = (vrow.meta.get("simulation") or {}) if vrow else {}
    return {
        "id": ds.id,
        "version": vrow.version if vrow else ds.version,
        "title": ds.title,
        "category": ds.category,
        "simulation_role": sim.get("role"),
        "owner": {"id": ds.owner.id, "display_name": ds.owner.display_name},
        "visibility": ds.visibility,
        "license": ds.license,
        "source": (vrow.meta.get("source") if vrow else None),
        "updated_at": ds.updated_at,
        "temporal": vrow.meta.get("temporal") if vrow else None,
        "status": ds.status,
        "record_count": s.get("record_count", 0),
        "features_with_geometry": s.get("features_with_geometry", 0),
        "geometry_type": s.get("geometry_type", "none"),
        "bbox": s.get("bbox"),
        "fields": s.get("fields", []),
        "charts": s.get("charts", []),
        "notes": s.get("notes", []),
    }


@router.get("/datasets/{dataset_id}/summary", tags=["Visualization"])
def get_summary(dataset_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return dataset_summary(get_visible(db, user, dataset_id))


def read_geometry(ds: Dataset, version: int | None = None, file_id: str | None = None,
                  simplify: float = 0, bbox: list[float] | None = None, limit: int = 5000) -> dict:
    vrow = ds.version_row(version)
    file_meta = {f["name"]: f for f in vrow.meta["files"]}
    features = []
    for f in vrow.files:
        if file_id and f.id != file_id:
            continue
        table = ingest.read_table(Path(f.storage_path), f.format, file_meta.get(f.name))
        if table is None or not table.geometries:
            continue
        for row, geom in zip(table.rows, table.geometries):
            if not geom:
                continue
            if bbox:
                fb = ingest.bbox_of([geom])
                if not fb or fb[2] < bbox[0] or fb[0] > bbox[2] or fb[3] < bbox[1] or fb[1] > bbox[3]:
                    continue
            features.append({"type": "Feature",
                             "properties": {**row, "_dataset": ds.id, "_file": f.name},
                             "geometry": ingest.simplify_geometry(geom, simplify)})
            if len(features) >= limit:
                break
        if len(features) >= limit:
            break
    return ingest.clean_json({"type": "FeatureCollection", "features": features})


@router.get("/datasets/{dataset_id}/geometry", tags=["Visualization"])
def get_geometry(dataset_id: str, file_id: Optional[str] = None,
                 simplify: float = Query(0, ge=0), bbox: Optional[str] = None,
                 limit: int = Query(5000, ge=1, le=50000),
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    ds = get_visible(db, user, dataset_id)
    box = None
    if bbox:
        try:
            box = [float(x) for x in bbox.split(",")]
            assert len(box) == 4
        except (ValueError, AssertionError):
            raise ApiError(400, "validation_error", "bbox must be minx,miny,maxx,maxy") from None
    fc = read_geometry(ds, file_id=file_id, simplify=simplify, bbox=box, limit=limit)
    if not fc["features"] and not (ds.version_row().summary or {}).get("has_geometry"):
        raise ApiError(404, "no_geometry", "This dataset has no spatial component.")
    from fastapi.responses import JSONResponse

    return JSONResponse(fc, media_type="application/geo+json")


# ---------------------------------------------------------------- removal requests


class RemovalBody(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/datasets/{dataset_id}/removal-requests", status_code=201, tags=["Removal requests"])
def request_removal(dataset_id: str, body: RemovalBody, user: User = Depends(current_user),
                    db: Session = Depends(get_db)) -> dict:
    ds = get_visible(db, user, dataset_id)
    if ds.owner_id != user.id:
        raise ApiError(403, "forbidden", "You can only request removal of your own datasets.")
    pending = db.scalar(select(RemovalRequest).where(RemovalRequest.dataset_id == ds.id,
                                                     RemovalRequest.status == "pending"))
    if pending:
        raise ApiError(409, "removal_already_pending", "A removal request is already pending.",
                       {"request_id": pending.id})
    rr = RemovalRequest(dataset_id=ds.id, requested_by_id=user.id, reason=body.reason)
    db.add(rr)
    audit(db, user, "removal.request", ds.id, reason=body.reason)
    db.commit()
    db.refresh(rr)
    return serialize_removal(rr)


def purge_files(dataset_id: str) -> None:
    from ..datasets import storage_root

    shutil.rmtree(storage_root() / dataset_id, ignore_errors=True)
