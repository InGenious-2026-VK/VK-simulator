"""Transformers: pure functions that reshape raw source tables into contract shape.

No file access here, so every function can be tested with small in-memory tables.
"""

from __future__ import annotations

from typing import Sequence


def _year(cell) -> int | None:
    text = str(cell).strip()
    if text.isdigit() and 1900 < int(text) < 2100:
        return int(text)
    return None


def wide_years_to_tidy(table: Sequence[Sequence], labels: dict[str, str]) -> list[dict]:
    """Reshape a "one row per series, one column per year" table to tidy rows.

    table:  rows of cells as read from a spreadsheet, junk rows included.
    labels: row label in the source -> series name to output.

    Statistics sheets often stack several tables that reuse the same row labels.
    Only the first table is read: the first row holding at least five years is
    the header, and reading stops at the next such row.

    Returns [{"date": year, "series": name, "value": number}], sorted.
    Raises ValueError if the header or any requested label is missing.
    """

    def year_columns(row):
        return {i: _year(c) for i, c in enumerate(row) if _year(c) is not None}

    start = next((i for i, r in enumerate(table) if len(year_columns(r)) >= 5), None)
    if start is None:
        raise ValueError("no header row with years found")
    years = year_columns(table[start])

    out = []
    found = set()
    for row in table[start + 1 :]:
        if len(year_columns(row)) >= 5:
            break  # next table begins
        label = next((c for c in row if isinstance(c, str) and c.strip() in labels), None)
        if label is None:
            continue
        name = labels[label.strip()]
        found.add(name)
        for col, year in years.items():
            value = row[col] if col < len(row) else None
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                out.append({"date": year, "series": name, "value": value})

    missing = sorted(set(labels.values()) - found)
    if missing:
        raise ValueError(f"rows not found: {missing}")
    return sorted(out, key=lambda r: (r["date"], r["series"]))
