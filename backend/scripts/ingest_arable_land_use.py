"""Write arable land by crop group (Östergötland, hectares, one year) as an upload folder for the Data Lake window.

Source workbook: "1. Datainsamling Primärproduktion.xlsx" from the report
"Kartläggning av Östergötlands livsmedelssystem" (figures: Jordbruksverket).

The output folder gets <dataset id>/<dataset id>.csv and metadata.json
(app/viz/export.py). Upload both in the Data Lake window. Keep the output
folder outside the repository: data files do not belong in git.

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_arable_land_use.py "<path to the .xlsx>" "<output folder>"
"""

import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.export import write_upload  # noqa: E402
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
DATASET_ID = "arable-land-use"


def main(xlsx_path: str, out_dir: str) -> None:
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

    write_upload(
        out_dir,
        DATASET_ID,
        rows,
        ["category", "value"],
        {
            "title": "Arable land in Östergötland by crop",
            "description": f"Share of arable area by crop group, hectares, {YEAR}.",
            "category": "production",
            "source": {"organization": "Jordbruksverket"},
            "spatial": {"region": "Östergötland", "geometry_type": "none"},
        },
        unit="ha",
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
