"""Write food consumption per person in Sweden (kg or litres a year) as an upload folder for the Data Lake window.

Source workbook: "4. Datainsamling Konsumtionsmönster.xlsx" from the report
"Kartläggning av Östergötlands livsmedelssystem", sheet "Totalkonsumtion
livsmedel" (figures: Jordbruksverket, national, 1980 onwards; preliminary
years are left out).

The sheet's "SUMMA ..." rows and "Matpotatis" (fresh + processed potatoes) are
sums of other rows, so they are not copied.

The output folder gets <dataset id>/<dataset id>.csv and metadata.json
(app/viz/export.py). Upload both in the Data Lake window. Keep the output
folder outside the repository: data files do not belong in git.

Usage (from the backend folder, with the venv active):
    pip install openpyxl
    python scripts/ingest_food_consumption.py "<path to the .xlsx>" "<output folder>"
"""

import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.viz.export import write_upload  # noqa: E402
from app.viz.transform import wide_years_to_tidy  # noqa: E402

SHEET = "Totalkonsumtion livsmedel"
DATASET_ID = "food-consumption"
LABELS = {
    "Vetemjöl": "Wheat flour",
    "Rågmjöl": "Rye flour",
    "Gryn och mjöl av ris": "Rice and rice flour",
    "Gryn och mjöl av havre och korn m.m.": "Oats, barley and other grains",
    "Nötkött inklusive kalvkött, vara med ben": "Beef and veal",
    "Fårkött, vara med ben": "Lamb and mutton",
    "Hästkött, vara med ben": "Horse meat",
    "Griskött, vara med ben": "Pork",
    "Renkött, vara med ben": "Reindeer meat",
    "Fjäderfäkött, urtagen vara": "Poultry",
    "Kött av vilt": "Game meat",
    "Inälvor": "Offal",
    "Fisk, färsk och fryst": "Fish, fresh and frozen",
    "Konserver och beredd fisk": "Fish, canned and prepared",
    "Konsumtionsmjölk, liter": "Milk (litres)",
    "Syrade produkter, liter": "Fermented milk products (litres)",
    "Tjock grädde": "Double cream",
    "Tunn grädde": "Single cream",
    "Ost (inkl. margarinost)": "Cheese",
    "Smör": "Butter",
    "Hushållsmargarin och Bregott": "Margarine and butter blends",
    "Lättmargarin": "Low-fat margarine",
    "Bagerimargarin": "Bakery margarine",
    "Bageri- och matolja": "Cooking oil",
    "Kokosfett, friteringsfett m.m.": "Coconut and frying fat",
    "Ägg": "Eggs",
    "Färskpotatis, inkl. skalad potatis": "Potatoes, fresh",
    "Potatisinnehåll i förädlade produkter": "Potatoes in processed food",
    "Socker och sirap (vitsockervärde)": "Sugar and syrup",
    "Kaffe, rostat": "Coffee, roasted",
    "Te": "Tea",
    "Köksväxter, färska och frysta": "Vegetables, fresh and frozen",
    "Köksväxter  beredda": "Vegetables, prepared",  # two spaces, as in the sheet
    "Frukter och bär, färska och frysta": "Fruit and berries, fresh and frozen",
    "Frukter och bär, beredda": "Fruit and berries, prepared",
}


def main(xlsx_path: str, out_dir: str) -> None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    rows = wide_years_to_tidy(list(wb[SHEET].iter_rows(values_only=True)), LABELS)
    # Keep the sheet's order of food items (wide_years_to_tidy sorts by date first).
    order = {name: i for i, name in enumerate(LABELS.values())}
    rows.sort(key=lambda r: (order[r["series"]], r["date"]))

    write_upload(
        out_dir,
        DATASET_ID,
        rows,
        ["date", "series", "value"],
        {
            "title": "Food consumption per person in Sweden",
            "description": "Kilograms (milk products: litres) per person and year, by food item.",
            "category": "demand",
            "source": {"organization": "Jordbruksverket"},
            "spatial": {"region": "Sweden", "geometry_type": "none"},
        },
        unit=None,
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
