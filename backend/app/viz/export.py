"""Write a chart-ready table as a folder the Data Lake window can upload.

The ingest scripts (backend/scripts/ingest_*.py) turn source workbooks into
tables in contract shape. This module writes such a table as
<out_dir>/<dataset_id>/<dataset_id>.csv plus the metadata.json the platform
requires (documentation/api/dataset-metadata.schema.json). Upload both files
in the Data Lake window; the data itself never goes into the repository.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from ..metadata import validate_metadata

# Column type and role in metadata.json for each contract column.
COLUMN_META = {
    "date": {"type": "integer", "role": "time"},
    "series": {"type": "string", "role": "category"},
    "category": {"type": "string", "role": "category"},
    "name": {"type": "string", "role": "name"},
    "lat": {"type": "number", "role": "latitude"},
    "lon": {"type": "number", "role": "longitude"},
    "value": {"type": "number", "role": "measure"},
}


def write_upload(out_dir: str | Path, dataset_id: str, rows: list[dict], columns: list[str],
                 meta: dict, unit: str | None = None) -> Path:
    """Write the CSV and metadata.json; returns the folder.

    meta: metadata.json fields other than schema_version and files (title,
    description, category, source, ...). unit: the unit of the value column.
    Raises ValueError if the metadata would be rejected at upload.
    """
    folder = Path(out_dir) / dataset_id
    folder.mkdir(parents=True, exist_ok=True)
    file_name = f"{dataset_id}.csv"

    cols = []
    for c in columns:
        col = {"name": c, **COLUMN_META.get(c, {"type": "string"})}
        if c == "value" and unit:
            col["unit"] = unit
        cols.append(col)
    metadata = {
        "schema_version": "1.0",
        "license": "proprietary",  # check the source's terms before making it public
        "sensitivity": "internal",
        **meta,
        "files": [{"name": file_name, "format": "csv", "delimiter": ",", "columns": cols}],
    }
    errors = validate_metadata(metadata)
    if errors:
        raise ValueError(f"metadata.json would be rejected: {errors}")

    with (folder / file_name).open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    (folder / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
    print(f"Wrote {len(rows)} rows and metadata.json to {folder}")
    return folder
