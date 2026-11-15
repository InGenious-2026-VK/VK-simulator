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

SHEET = "SILOdata"
# The sheet holds several tables. This one is the first, and its value column
# is the one headed "Svenskt ursprung" (Swedish origin).
VALUE_HEADER = "Svenskt ursprung"
OUT_FILE = "swedish-vegetables-public-kitchens.csv"

# The workbook has no coordinates. These are the municipality's main town
# (WGS84 decimal degrees), keyed by the official municipality code.
PLACES = {
    "0509": ("Ödeshög", 58.229, 14.653),
    "0512": ("Ydre", 57.826, 15.274),
    "0513": ("Kinda", 57.988, 15.632),
    "0560": ("Boxholm", 58.197, 15.053),
    "0561": ("Åtvidaberg", 58.201, 15.997),
    "0562": ("Finspång", 58.706, 15.767),
    "0563": ("Valdemarsvik", 58.203, 16.602),
    "0580": ("Linköping", 58.411, 15.621),
    "0581": ("Norrköping", 58.592, 16.186),
    "0582": ("Söderköping", 58.481, 16.323),
    "0583": ("Motala", 58.537, 15.037),
    "0584": ("Vadstena", 58.449, 14.890),
    "0586": ("Mjölby", 58.326, 15.124),
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
