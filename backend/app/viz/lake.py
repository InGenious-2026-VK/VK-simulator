"""Loaders: datasets from the platform's data lake, as rows a chart can draw.

The overview window shows the datasets a user selected in the Data Lake window.
Those datasets are uploaded like any other (a data file plus metadata.json,
see documentation/api/README.md). This module reads their files with
app.ingest, picks the first file whose columns fit a chart type
(contract.CHART_TYPES) and checks its rows against the contract.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from .. import ingest
from ..access import get_visible
from ..errors import ApiError
from ..orm import Dataset, User
from ..routers.selections import load_selection, resolve
from .contract import CHART_TYPES, ContractError, validate

# Tried in this order. Each type's columns are told apart by name: a file with
# name, lat, lon and value is a bubble map even if it also has a category.
DETECT_ORDER = ("bubble-map", "line", "pie")


def detect_type(columns) -> str | None:
    """The chart type whose required columns the file has, or None."""
    have = set(columns)
    return next((t for t in DETECT_ORDER if set(CHART_TYPES[t]["columns"]) <= have), None)


def _chart_file(ds: Dataset, version: int | None):
    """(chart type, file metadata, table) for the dataset's first chartable file.
    Raises ContractError if no file has the columns of a chart type."""
    vrow = ds.version_row(version)
    if vrow is None:
        raise ContractError("this version of the dataset no longer exists")
    file_meta = {f["name"]: f for f in vrow.meta.get("files", [])}
    for f in vrow.files:
        meta = file_meta.get(f.name, {})
        table = ingest.read_table(Path(f.storage_path), f.format, meta)
        if table is None:
            continue
        chart_type = detect_type(table.columns)
        if chart_type:
            return chart_type, meta, table
    wanted = "; ".join(f"{t}: {', '.join(CHART_TYPES[t]['columns'])}" for t in DETECT_ORDER)
    raise ContractError(f"no file has the columns of a chart type ({wanted})")


def _meta(ds: Dataset, version: int | None, chart_type: str, file_meta: dict) -> dict:
    vrow = ds.version_row(version)
    value_col = next((c for c in file_meta.get("columns", []) if c.get("name") == "value"), {})
    return {
        "id": ds.id,
        "version": vrow.version,
        "type": chart_type,
        "title": ds.title,
        "subtitle": vrow.meta.get("description"),
        "unit": value_col.get("unit"),
        "source": (vrow.meta.get("source") or {}).get("organization"),
    }


def load(ds: Dataset, version: int | None = None) -> dict:
    """Metadata plus validated rows. Raises ContractError."""
    chart_type, file_meta, table = _chart_file(ds, version)
    try:
        rows = validate(table.rows, chart_type)
    except ContractError as e:
        raise ContractError(f"{file_meta.get('name', 'file')}: {e}") from None
    return {**_meta(ds, version, chart_type, file_meta), "rows": ingest.clean_json(rows)}


def load_visible(db: Session, user: User, dataset_id: str, version: int | None = None) -> dict:
    """load() for a dataset the user may see; 404 otherwise, 422 if it cannot be charted."""
    ds = get_visible(db, user, dataset_id)
    try:
        return load(ds, version)
    except ContractError as e:
        raise ApiError(422, "not_chartable", f"{ds.title}: {e}", {"dataset_id": ds.id}) from None


def selection_datasets(db: Session, user: User, selection_id: str) -> dict:
    """The selection's datasets that can be charted, and the others with the reason."""
    sel = load_selection(db, user, selection_id)
    ok, gone = resolve(db, user, sel)
    datasets, skipped = [], list(gone)
    for ds, version in ok:
        try:
            datasets.append({k: v for k, v in load(ds, version).items() if k != "rows"})
        except ContractError as e:
            skipped.append({"id": ds.id, "title": ds.title, "reason": "not_chartable", "message": str(e)})
    return {"selection_id": sel.id, "datasets": datasets, "skipped": skipped}
