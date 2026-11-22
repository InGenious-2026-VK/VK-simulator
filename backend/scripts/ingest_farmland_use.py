"""Write farmland area by land type (Östergötland, hectares) as an upload folder for the Data Lake window.

Source workbook: "1. Datainsamling Primärproduktion.xlsx" from the report
"Kartläggning av Östergötlands livsmedelssystem" (figures: Jordbruksverket).

The output folder gets <dataset id>/<dataset id>.csv and metadata.json
(app/viz/export.py). Upload both in the Data Lake window. Keep the output
folder outside the repository: data files do not belong in git.

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_farmland_use.py "<path to the .xlsx>" "<output folder>"
"""

import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.export import write_upload  # noqa: E402
from app.viz.transform import wide_years_to_tidy  # noqa: E402

SHEET_PREFIX = "Jordbruksmarkens"
LABELS = {"Åkermark": "Arable land", "Betesmark": "Pasture"}
DATASET_ID = "farmland-use"


def main(xlsx_path: str, out_dir: str) -> None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = next(s for s in wb.worksheets if s.title.startswith(SHEET_PREFIX))
    rows = wide_years_to_tidy(list(ws.iter_rows(values_only=True)), LABELS)

    write_upload(
        out_dir,
        DATASET_ID,
        rows,
        ["date", "series", "value"],
        {
            "title": "Farmland in Östergötland",
            "description": "Area by land type (arable land, pasture), hectares, by year.",
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
