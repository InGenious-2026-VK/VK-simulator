"""Write arable land by crop group (Östergötland, hectares, one year) into the data lake.

Source workbook: "1. Datainsamling Primärproduktion.xlsx" from the report
"Kartläggning av Östergötlands livsmedelssystem" (figures: Jordbruksverket).

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_arable_land_use.py "<path to the .xlsx>"
"""

import csv
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.lake import lake_dir  # noqa: E402
from app.viz.transform import wide_years_to_tidy  # noqa: E402

SHEET_PREFIX = "Jordbruksmarkens"
# The sheet stacks several tables; the crop table starts at this heading.
TABLE_HEADING = "Åkermarkens användning"
HEADER_LABEL = "Gröda"  # first cell of the table's header row
YEAR = 2024  # latest final year (2025 is preliminary)
LABELS = {
    "Summa spannmål": "Cereals",
    "Summa vall och grönfoderv.": "Ley and green fodder",
    "Summa raps och rybs": "Rapeseed and turnip rape",
    "Summa Träda": "Fallow",
    "Summa baljväxter": "Legumes",
    "Summa potatis och sockerbetor": "Potatoes and sugar beet",
    "Summa övrigt": "Other",
}
OUT_FILE = "arable-land-use.csv"


def main(xlsx_path: str) -> None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = next(s for s in wb.worksheets if s.title.startswith(SHEET_PREFIX))
    table = list(ws.iter_rows(values_only=True))
    start = next(i for i, row in enumerate(table) if TABLE_HEADING in row)
    # Other tables sit to the right of this one and repeat the year columns.
    # Keep only the columns up to where the header starts over.
    header = next(row for row in table[start:] if HEADER_LABEL in row)
    width = header.index(HEADER_LABEL, header.index(HEADER_LABEL) + 1)

    tidy = wide_years_to_tidy([row[:width] for row in table[start:]], LABELS)
    rows = [
        {"category": r["series"], "value": r["value"]} for r in tidy if r["date"] == YEAR
    ]
    rows.sort(key=lambda r: -r["value"])  # biggest slice first

    out = lake_dir() / OUT_FILE
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["category", "value"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
