"""Place master table: where Swedish municipalities and towns are on the map.

PLACEHOLDER, NOT YET REVIEWED BY A PERSON. The table comes from Wikidata
(scripts/build_places.py) and every row has reviewed = "no". Towns cover
Östergötland only. See app/data/reference/README.md.

Source workbooks name places but have no coordinates. Ingest scripts use this
module to turn a municipality code or a place name into lat/lon, instead of
typing coordinates in by hand.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

PLACES_FILE = Path(__file__).resolve().parent.parent / "data" / "reference" / "places.csv"


@lru_cache(maxsize=1)
def load_places() -> tuple[dict, ...]:
    """Every row of the table, with lat, lon and population as numbers."""
    with PLACES_FILE.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["lat"] = float(r["lat"])
        r["lon"] = float(r["lon"])
        r["population"] = int(r["population"]) if r["population"] else None
    return tuple(rows)


def _norm(name: str) -> str:
    return " ".join(name.split()).casefold()


def municipality(key: str) -> dict:
    """A municipality by its four-digit code ("0580") or name ("Linköping",
    "Linköpings kommun"). Its position is the municipality's seat.
    Raises KeyError if there is no such municipality."""
    key = key.strip()
    rows = [r for r in load_places() if r["kind"] == "municipality"]
    if key.isdigit():
        match = [r for r in rows if r["municipality_code"] == key.zfill(4)]
    else:
        wanted = _norm(key)
        # "Linköpings kommun" -> "linköping"; "Borås kommun" -> "borås".
        if wanted.endswith(" kommun"):
            wanted = wanted.removesuffix(" kommun")
            candidates = {wanted, wanted.removesuffix("s")}
        else:
            candidates = {wanted}
        match = [r for r in rows if _norm(r["name"]) in candidates]
    if not match:
        raise KeyError(f"unknown municipality: {key!r}")
    return match[0]


def town(name: str, municipality_code: str | None = None) -> dict:
    """A town (tätort) by name. Town names repeat across Sweden, so pass the
    municipality code when the name is not unique.
    Raises KeyError if not found, ValueError if the name is ambiguous."""
    wanted = _norm(name)
    match = [
        r for r in load_places()
        if r["kind"] == "town"
        and _norm(r["name"]) == wanted
        and (municipality_code is None or r["municipality_code"] == municipality_code)
    ]
    if not match:
        raise KeyError(f"unknown town: {name!r} (the table only has towns in Östergötland so far)")
    if len(match) > 1:
        codes = ", ".join(r["municipality_code"] for r in match)
        raise ValueError(f"town {name!r} exists in several municipalities ({codes}); pass municipality_code")
    return match[0]
