"""Validation of the standard dataset metadata file (metadata.json).

The schema file is a copy of documentation/api/dataset-metadata.schema.json
(a test keeps the two identical).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_PATH = Path(__file__).parent / "schemas" / "dataset-metadata.schema.json"


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _pointer(path) -> str:
    return "/" + "/".join(str(p) for p in path) if path else "/"


def validate_metadata(meta: object) -> list[dict]:
    """Returns a list of {path, message}; empty when valid."""
    if not isinstance(meta, dict):
        return [{"path": "/", "message": "metadata must be a JSON object"}]
    errors = []
    for err in sorted(_validator().iter_errors(meta), key=lambda e: list(e.absolute_path)):
        if err.validator == "required":
            # "'license' is a required property" -> point at the missing field
            missing = err.message.split("'")[1] if "'" in err.message else ""
            errors.append({"path": _pointer([*err.absolute_path, missing]), "message": "is required"})
        else:
            errors.append({"path": _pointer(err.absolute_path), "message": err.message})

    files = meta.get("files") if isinstance(meta.get("files"), list) else []
    names = [f.get("name") for f in files if isinstance(f, dict)]
    if len(names) != len(set(names)):
        errors.append({"path": "/files", "message": "file names must be unique"})

    sim = meta.get("simulation")
    if isinstance(sim, dict) and isinstance(sim.get("mapping"), dict):
        mfile = sim["mapping"].get("file")
        if mfile and mfile not in names:
            errors.append({"path": "/simulation/mapping/file",
                           "message": f"{mfile!r} is not listed in files"})
    return errors


def parse_metadata(raw: bytes) -> tuple[dict | None, list[dict]]:
    try:
        meta = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        return None, [{"path": "/", "message": f"not valid JSON: {exc}"}]
    return meta, validate_metadata(meta)


TEMPLATE = {
    "schema_version": "1.0",
    "title": "Short descriptive title",
    "description": "What the data is, how it was produced, and any caveats.",
    "category": "processing",
    "keywords": ["example"],
    "source": {
        "organization": "Who produced the data",
        "url": "https://example.org/source",
        "collected_at": "2026-01-01",
        "method": "Survey / sensor / derived from …",
    },
    "license": "CC-BY-4.0",
    "contact": {"name": "Data steward", "email": "steward@example.org"},
    "sensitivity": "internal",
    "spatial": {"crs": "EPSG:4326", "region": "Östergötland", "geometry_type": "point"},
    "temporal": {"start": "2025-01-01", "end": "2025-12-31", "resolution": "month"},
    "files": [
        {
            "name": "facilities.csv",
            "format": "csv",
            "description": "One row per facility.",
            "columns": [
                {"name": "facility_id", "type": "string", "role": "id"},
                {"name": "name", "type": "string", "role": "name"},
                {"name": "lat", "type": "number", "role": "latitude"},
                {"name": "lon", "type": "number", "role": "longitude"},
                {"name": "capacity_tpd", "type": "number", "unit": "t/day", "role": "measure"},
            ],
        }
    ],
    "simulation": {
        "role": "processing",
        "mapping": {"file": "facilities.csv", "id": "facility_id", "name": "name",
                    "capacity_tpd": "capacity_tpd"},
    },
}
