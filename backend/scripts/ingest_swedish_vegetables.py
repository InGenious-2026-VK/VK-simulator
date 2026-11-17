"""Write the Swedish-origin share of fresh vegetables bought by each municipality
(Östergötland, 2023, percent of cost) into the data lake, with a map position.

Source workbook: "5. Datainsamling offentliga måltider och upphandling.xlsx" from
the report "Kartläggning av Östergötlands livsmedelssystem" (figures:
Jordbruksverket, SILO database).

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_swedish_vegetables.py "<path to the .xlsx>"
"""

import csv
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.lake import lake_dir  # noqa: E402
from app.viz.places import load_places  # noqa: E402

SHEET = "SILOdata"
# The sheet holds several tables. This one is the first, and its value column
# is the one headed "Svenskt ursprung" (Swedish origin).
VALUE_HEADER = "Svenskt ursprung"
OUT_FILE = "swedish-vegetables-public-kitchens.csv"

# The workbook has no coordinates. Positions come from the place master table
# (app/data/reference/places.csv, a placeholder still to be reviewed): each
# municipality is drawn at its seat. Östergötland is county code 05.
PLACES = {
    p["municipality_code"]: (p["name"], p["lat"], p["lon"])
    for p in load_places()
    if p["kind"] == "municipality" and p["county_code"] == "05"
}


def main(xlsx_path: str) -> None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    table = list(wb[SHEET].iter_rows(values_only=True))

    start, header = next((i, row) for i, row in enumerate(table) if VALUE_HEADER in row)
    value_col = header.index(VALUE_HEADER)
    label_col = value_col - 1

    rows = []
    found = set()
    for row in table[start + 1 :]:
        label = row[label_col]
        if label is None:
            break  # end of the first table
        code = str(label).split()[0]
        if code not in PLACES:
            continue  # the "all municipalities" row
        found.add(code)
        name, lat, lon = PLACES[code]
        rows.append({"name": name, "lat": lat, "lon": lon, "value": float(row[value_col])})

    missing = sorted(set(PLACES) - found)
    if missing:
        raise ValueError(f"municipalities not found in the sheet: {missing}")

    out = lake_dir() / OUT_FILE
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "lat", "lon", "value"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
