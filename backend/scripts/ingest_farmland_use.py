"""Write farmland area by land type (Östergötland, hectares) into the data lake.

Source workbook: "1. Datainsamling Primärproduktion.xlsx" from the report
"Kartläggning av Östergötlands livsmedelssystem" (figures: Jordbruksverket).

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_farmland_use.py "<path to the .xlsx>"
"""

import csv
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.lake import lake_dir  # noqa: E402
from app.viz.transform import wide_years_to_tidy  # noqa: E402

SHEET_PREFIX = "Jordbruksmarkens"
LABELS = {"Åkermark": "Arable land", "Betesmark": "Pasture"}
OUT_FILE = "farmland-use.csv"


def main(xlsx_path: str) -> None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = next(s for s in wb.worksheets if s.title.startswith(SHEET_PREFIX))
    rows = wide_years_to_tidy(list(ws.iter_rows(values_only=True)), LABELS)

    out = lake_dir() / OUT_FILE
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "series", "value"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
