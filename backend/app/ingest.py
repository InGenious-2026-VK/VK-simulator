"""Reading uploaded data files, profiling their columns, and picking charts.

Supported for profiling / geometry / simulation input:
  csv, xlsx, json (array of objects, {"data": [...]}, or GeoJSON), geojson.
Accepted and stored but not profiled (record_count / columns stay empty):
  gpkg, shapefile (zipped), parquet — reading those needs GDAL / Arrow, which
  the prototype doesn't ship.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

PROFILED_FORMATS = {"csv", "xlsx", "json", "geojson"}
EXT_FORMATS = {
    ".csv": "csv",
    ".tsv": "csv",
    ".xlsx": "xlsx",
    ".json": "json",
    ".geojson": "geojson",
    ".gpkg": "gpkg",
    ".zip": "shapefile",
    ".parquet": "parquet",
}
LAT_NAMES = {"lat", "latitude", "y"}
LON_NAMES = {"lon", "lng", "long", "longitude", "x"}

# Seats of Östergötland's 13 municipalities (approximate, for coverage counts).
MUNICIPALITIES = {
    "Boxholm": (15.05, 58.20), "Finspång": (15.77, 58.71), "Kinda": (15.63, 57.99),
    "Linköping": (15.62, 58.41), "Mjölby": (15.13, 58.32), "Motala": (15.04, 58.54),
    "Norrköping": (16.19, 58.59), "Söderköping": (16.32, 58.48), "Vadstena": (14.89, 58.45),
    "Valdemarsvik": (16.60, 58.20), "Ydre": (15.27, 57.82), "Åtvidaberg": (16.00, 58.20),
    "Ödeshög": (14.65, 58.23),
}


def format_from_name(name: str) -> str | None:
    return EXT_FORMATS.get(Path(name).suffix.lower())


# ---------------------------------------------------------------- reading


@dataclass
class Table:
    columns: list[str]
    rows: list[dict[str, Any]]
    # One GeoJSON geometry (or None) per row, when the file is spatial.
    geometries: list[dict | None] | None = None
    notes: list[str] = field(default_factory=list)


def _coerce(value: Any) -> Any:
    """Turn CSV strings into numbers / bools where unambiguous."""
    if not isinstance(value, str):
        return value
    v = value.strip()
    if v == "":
        return None
    low = v.lower()
    if low in {"true", "false"}:
        return low == "true"
    if re.fullmatch(r"[-+]?\d+", v):
        try:
            return int(v)
        except ValueError:
            return v
    if re.fullmatch(r"[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?", v):
        return float(v)
    return v


def _read_csv(path: Path, delimiter: str | None, encoding: str) -> Table:
    text = path.read_text(encoding=encoding, errors="replace")
    if text.startswith("﻿"):
        text = text[1:]
    if not delimiter:
        try:
            delimiter = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
        except csv.Error:
            delimiter = ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows = [{k: _coerce(v) for k, v in r.items() if k is not None} for r in reader]
    return Table(columns=list(reader.fieldnames or []), rows=rows)


def _read_xlsx(path: Path) -> Table:
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    header = next(it, None) or []
    cols = [str(h) if h is not None else f"col_{i + 1}" for i, h in enumerate(header)]
    rows = []
    for raw in it:
        if raw is None or all(v is None for v in raw):
            continue
        row = {}
        for c, v in zip(cols, raw):
            if isinstance(v, datetime):
                v = v.date().isoformat() if v.time() == datetime.min.time() else v.isoformat()
            elif isinstance(v, date):
                v = v.isoformat()
            row[c] = _coerce(v) if isinstance(v, str) else v
        rows.append(row)
    wb.close()
    return Table(columns=cols, rows=rows)


def _from_features(features: list[dict]) -> Table:
    rows, geoms, cols = [], [], {}
    for f in features:
        props = dict(f.get("properties") or {})
        if "id" in f and "id" not in props:
            props["id"] = f["id"]
        for k in props:
            cols.setdefault(k, None)
        rows.append(props)
        geoms.append(f.get("geometry"))
    return Table(columns=list(cols), rows=rows, geometries=geoms)


def _read_json(path: Path, encoding: str) -> Table:
    data = json.loads(path.read_text(encoding=encoding))
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        return _from_features(data.get("features") or [])
    if isinstance(data, dict):
        for key in ("data", "rows", "records", "items"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
    if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
        raise ValueError("JSON must be an array of objects, {\"data\": [...]}, or GeoJSON")
    cols: dict[str, None] = {}
    for r in data:
        for k in r:
            cols.setdefault(k, None)
    return Table(columns=list(cols), rows=data)


def read_table(path: Path, fmt: str, file_meta: dict | None = None) -> Table | None:
    """Returns None for formats the prototype can store but not read."""
    file_meta = file_meta or {}
    encoding = file_meta.get("encoding") or "utf-8"
    if fmt == "csv":
        t = _read_csv(path, file_meta.get("delimiter"), encoding)
    elif fmt == "xlsx":
        t = _read_xlsx(path)
    elif fmt in {"json", "geojson"}:
        t = _read_json(path, encoding)
    else:
        return None
    if t.geometries is None:
        _derive_point_geometry(t, file_meta)
    return t


def _derive_point_geometry(t: Table, file_meta: dict) -> None:
    """Build point geometries from latitude / longitude columns if present."""
    roles = {c.get("role"): c.get("name") for c in file_meta.get("columns") or []}
    lower = {c.lower(): c for c in t.columns}
    lat = roles.get("latitude") or next((lower[n] for n in LAT_NAMES if n in lower), None)
    lon = roles.get("longitude") or next((lower[n] for n in LON_NAMES if n in lower), None)
    if not lat or not lon:
        return
    geoms = []
    for r in t.rows:
        x, y = r.get(lon), r.get(lat)
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            geoms.append({"type": "Point", "coordinates": [float(x), float(y)]})
        else:
            geoms.append(None)
    if any(geoms):
        t.geometries = geoms


# ---------------------------------------------------------------- geometry helpers


def _walk_coords(coords):
    if not coords:
        return
    if isinstance(coords[0], (int, float)):
        yield coords
        return
    for c in coords:
        yield from _walk_coords(c)


def geometry_points(geom: dict | None):
    if not geom:
        return
    if geom.get("type") == "GeometryCollection":
        for g in geom.get("geometries") or []:
            yield from geometry_points(g)
        return
    yield from _walk_coords(geom.get("coordinates"))


def bbox_of(geoms) -> list[float] | None:
    xs, ys = [], []
    for g in geoms or []:
        for p in geometry_points(g):
            xs.append(p[0])
            ys.append(p[1])
    if not xs:
        return None
    return [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]


def representative_point(geom: dict | None) -> list[float] | None:
    """Point → itself; anything else → mean of its vertices."""
    pts = list(geometry_points(geom))
    if not pts:
        return None
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]


def _simplify_coords(coords, tol: float):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(round(coords[0] / tol) * tol, 6), round(round(coords[1] / tol) * tol, 6)]
    out = [_simplify_coords(c, tol) for c in coords]
    if out and isinstance(out[0], list) and out[0] and isinstance(out[0][0], (int, float)):
        dedup = [out[0]]
        for p in out[1:]:
            if p != dedup[-1]:
                dedup.append(p)
        # keep rings / lines valid
        if len(dedup) < 2:
            dedup = out[:2]
        out = dedup
    return out


def simplify_geometry(geom: dict | None, tol: float) -> dict | None:
    """Grid-snap simplification: snap vertices to a `tol`-degree grid and drop repeats."""
    if not geom or tol <= 0:
        return geom
    if geom.get("type") == "GeometryCollection":
        return {**geom, "geometries": [simplify_geometry(g, tol) for g in geom["geometries"]]}
    return {**geom, "coordinates": _simplify_coords(geom.get("coordinates"), tol)}


def geometry_kind(geoms) -> str:
    kinds = {(g or {}).get("type", "").replace("Multi", "") for g in geoms or [] if g}
    if not kinds:
        return "none"
    if kinds == {"Point"}:
        return "point"
    if kinds == {"LineString"}:
        return "line"
    if kinds == {"Polygon"}:
        return "polygon"
    return "mixed"


# ---------------------------------------------------------------- profiling

_DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?([T ][\d:.]+Z?)?$")


def _infer_type(values: list[Any]) -> str:
    present = [v for v in values if v is not None]
    if not present:
        return "string"
    if all(isinstance(v, bool) for v in present):
        return "boolean"
    if all(isinstance(v, int) and not isinstance(v, bool) for v in present):
        return "integer"
    if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in present):
        return "number"
    if all(isinstance(v, str) and _DATE_RE.match(v) for v in present):
        return "datetime" if any("T" in v or " " in v for v in present) else "date"
    return "string"


def _histogram(nums: list[float], bins: int = 6) -> dict:
    lo, hi = min(nums), max(nums)
    if lo == hi:
        return {"bins": [lo, hi], "counts": [len(nums)]}
    step = (hi - lo) / bins
    edges = [round(lo + i * step, 4) for i in range(bins + 1)]
    counts = [0] * bins
    for v in nums:
        counts[min(int((v - lo) / step), bins - 1)] += 1
    return {"bins": edges, "counts": counts}


def profile_columns(t: Table, file_meta: dict | None = None) -> list[dict]:
    meta_cols = {c["name"]: c for c in (file_meta or {}).get("columns") or []}
    n = len(t.rows) or 1
    out = []
    for col in t.columns:
        values = [r.get(col) for r in t.rows]
        declared = meta_cols.get(col, {})
        typ = declared.get("type") or _infer_type(values)
        present = [v for v in values if v is not None and v != ""]
        prof: dict[str, Any] = {
            "name": col,
            "type": typ,
            "unit": declared.get("unit"),
            "role": declared.get("role"),
            "description": declared.get("description"),
            "missing_pct": round(100 * (len(values) - len(present)) / n, 1),
        }
        nums = [float(v) for v in present if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if typ in {"integer", "number"} and nums:
            prof.update(
                min=min(nums),
                max=max(nums),
                mean=round(sum(nums) / len(nums), 3),
                histogram=_histogram(nums),
            )
        elif typ in {"date", "datetime"} and present:
            s = sorted(str(v) for v in present)
            prof.update(min=s[0], max=s[-1])
        elif present:
            counts = Counter(str(v) for v in present)
            prof["distinct"] = len(counts)
            prof["top_values"] = [{"value": v, "count": c} for v, c in counts.most_common(8)]
        out.append({k: v for k, v in prof.items() if v is not None})
    if t.geometries is not None:
        out.append(
            {
                "name": "geometry",
                "type": "geometry",
                "role": "geometry",
                "geometry_type": geometry_kind(t.geometries),
                "missing_pct": round(100 * sum(1 for g in t.geometries if not g) / n, 1),
            }
        )
    return out


# ---------------------------------------------------------------- charts


def _is_measure(c: dict) -> bool:
    return c["type"] in {"integer", "number"} and c.get("role") not in {
        "id", "latitude", "longitude", "time",
    } and c["name"].lower() not in LAT_NAMES | LON_NAMES | {"id"}


# Reference / list columns that look categorical but make meaningless charts.
NOT_CATEGORIES = {"depends_on", "serves", "source", "target", "from", "to", "geometry"}


def _is_category(c: dict) -> bool:
    if c.get("role") == "category":
        return True
    return (
        c["type"] == "string"
        and c.get("role") not in {"id", "name"}
        and c["name"].lower() not in NOT_CATEGORIES
        and not c["name"].lower().endswith("_id")
        and 1 < c.get("distinct", 0) <= 20
    )


def _is_time(c: dict) -> bool:
    return c.get("role") == "time" or c["type"] in {"date", "datetime"}


def charts_for(dataset_id: str, file_id: str, fname: str, t: Table, cols: list[dict]) -> list[dict]:
    charts: list[dict] = []
    measures = [c for c in cols if _is_measure(c)]
    times = [c for c in cols if _is_time(c)]
    cats = sorted((c for c in cols if _is_category(c)), key=lambda c: c.get("role") != "category")

    if times and measures:
        tc, mc = times[0]["name"], measures[0]["name"]
        agg: dict[str, float] = defaultdict(float)
        for r in t.rows:
            if r.get(tc) is not None and isinstance(r.get(mc), (int, float)):
                agg[str(r[tc])] += float(r[mc])
        data = [[k, round(v, 3)] for k, v in sorted(agg.items())][:120]
        if data:
            charts.append({"kind": "timeseries", "title": f"Total {mc} by {tc}", "file": fname,
                           "x": tc, "y": mc, "agg": "sum", "unit": measures[0].get("unit"),
                           "data": data})
    if cats:
        cc = cats[0]["name"]
        if measures:
            mc = measures[0]["name"]
            agg = defaultdict(float)
            for r in t.rows:
                if r.get(cc) is not None and isinstance(r.get(mc), (int, float)):
                    agg[str(r[cc])] += float(r[mc])
            data = sorted(([k, round(v, 3)] for k, v in agg.items()), key=lambda x: -x[1])[:12]
            charts.append({"kind": "bar", "title": f"{mc} by {cc}", "file": fname, "x": cc,
                           "y": mc, "agg": "sum", "unit": measures[0].get("unit"), "data": data})
        else:
            top = next(c for c in cols if c["name"] == cc).get("top_values", [])
            charts.append({"kind": "bar", "title": f"Records by {cc}", "file": fname, "x": cc,
                           "y": "count", "agg": "count",
                           "data": [[v["value"], v["count"]] for v in top]})
    if measures and not (times and cats):
        mc = measures[-1] if len(measures) > 1 and (times or cats) else measures[0]
        if "histogram" in mc:
            charts.append({"kind": "histogram", "title": f"Distribution of {mc['name']}",
                           "file": fname, "x": mc["name"], "unit": mc.get("unit"),
                           "data": mc["histogram"]})
    if t.geometries is not None and any(t.geometries):
        kind = geometry_kind(t.geometries)
        charts.append({
            "kind": "point_map" if kind == "point" else "choropleth" if kind == "polygon" else "line_map",
            "title": f"Features in {fname}",
            "file": fname,
            "geometry_url": f"/api/datasets/{dataset_id}/geometry?file_id={file_id}",
        })
    if not charts:
        charts.append({"kind": "table", "title": f"Preview of {fname}", "file": fname,
                       "columns": t.columns[:8],
                       "data": [[r.get(c) for c in t.columns[:8]] for r in t.rows[:10]]})
    return charts


# ---------------------------------------------------------------- dataset summary


def municipalities_in(bbox: list[float] | None) -> list[str]:
    if not bbox:
        return []
    return [m for m, (x, y) in MUNICIPALITIES.items()
            if bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]]


def union_bbox(boxes) -> list[float] | None:
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return [min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes)]


def clean_json(value: Any) -> Any:
    """Replace NaN/inf (invalid JSON) with None, recursively."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {k: clean_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_json(v) for v in value]
    return value
