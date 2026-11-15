"""Loaders: read the manifest and the CSV files of the data lake."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path

from .contract import ContractError, validate

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "data" / "lake"
MANIFEST = "datasets.json"
REQUIRED_META = ("id", "type", "file", "title")


def lake_dir() -> Path:
    return Path(os.environ.get("VIZ_DATA_DIR") or DEFAULT_DIR)


def list_datasets() -> list[dict]:
    """All manifest entries. Raises ContractError if the manifest is unusable."""
    path = lake_dir() / MANIFEST
    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ContractError(f"manifest not found: {path}") from None
    except json.JSONDecodeError as e:
        raise ContractError(f"{MANIFEST} is not valid JSON: {e}") from None
    for entry in entries:
        missing = [k for k in REQUIRED_META if k not in entry]
        if missing:
            raise ContractError(f"{MANIFEST}: entry {entry.get('id', '?')!r} lacks {missing}")
    return entries


def load_dataset(dataset_id: str) -> dict:
    """One manifest entry plus its validated rows. KeyError if the id is unknown."""
    meta = next((d for d in list_datasets() if d["id"] == dataset_id), None)
    if meta is None:
        raise KeyError(dataset_id)

    path = lake_dir() / meta["file"]
    try:
        # utf-8-sig: Excel-exported CSVs start with a byte-order mark.
        with path.open(newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
    except FileNotFoundError:
        raise ContractError(f"{dataset_id}: file not found: {meta['file']}") from None

    try:
        rows = validate(rows, meta["type"])
    except ContractError as e:
        raise ContractError(f"{meta['file']}: {e}") from None
    return {**public_meta(meta), "rows": rows}


def public_meta(meta: dict) -> dict:
    """Manifest entry as sent to the frontend (the file name stays internal)."""
    return {k: v for k, v in meta.items() if k != "file"}
