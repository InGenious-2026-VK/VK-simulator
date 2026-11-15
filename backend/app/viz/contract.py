"""The visualisation data contract: which columns each chart type needs.

Described for humans in documentation/visualisation-data-contract.md.
"""

from __future__ import annotations


class ContractError(ValueError):
    """A dataset does not match the contract."""


# chart type -> required columns, numeric columns, columns that identify a row
CHART_TYPES: dict[str, dict[str, tuple[str, ...]]] = {
    "line": {
        "columns": ("date", "series", "value"),
        "numeric": ("value",),
        "key": ("date", "series"),
    },
}


def validate(rows: list[dict[str, str]], chart_type: str) -> list[dict]:
    """Check rows (as read from CSV, all strings) and convert numeric columns.

    Returns new rows; raises ContractError naming the first problem found.
    """
    if chart_type not in CHART_TYPES:
        raise ContractError(f"unknown chart type '{chart_type}'")
    spec = CHART_TYPES[chart_type]

    if not rows:
        raise ContractError("dataset has no rows")
    missing = [c for c in spec["columns"] if c not in rows[0]]
    if missing:
        raise ContractError(f"missing column(s): {', '.join(missing)}")

    out = []
    seen = set()
    for line, row in enumerate(rows, start=2):  # line 1 is the header
        clean = dict(row)
        for col in spec["columns"]:
            if clean[col] is None or str(clean[col]).strip() == "":
                raise ContractError(f"line {line}: '{col}' is empty")
        for col in spec["numeric"]:
            try:
                clean[col] = float(clean[col])
            except ValueError:
                raise ContractError(
                    f"line {line}: '{col}' is not a number: {clean[col]!r}"
                ) from None
        key = tuple(clean[c] for c in spec["key"])
        if key in seen:
            raise ContractError(f"line {line}: duplicate {spec['key']} = {key}")
        seen.add(key)
        out.append(clean)
    return out
