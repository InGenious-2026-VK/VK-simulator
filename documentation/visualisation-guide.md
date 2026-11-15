# Visualisation: start here

This guide explains the visualisation groundwork: what it is, where the files
are, and how to do the common tasks. You do not need to read the code first.

**The app you see today is unchanged.** Nothing here is connected to the main
screen yet. The chart only shows on a separate test page. This is a structure
for the team to discuss and build on.

## What it does

It takes a table of numbers and draws it as a chart. So far there are two chart
types, each with one example table: a line chart (farmland area in Östergötland
over time) and a pie chart (arable land in Östergötland by crop).

## How the data travels

```
 Excel file from a report
        │   a script reshapes it (run once, by hand)
        ▼
 CSV file in the data folder          backend/app/data/lake/
        │   the backend checks it follows the rules
        ▼
 Web address that returns the data    /api/viz/datasets/farmland-use
        │   the frontend asks for it
        ▼
 Chart on screen                      <VisualisationPanel datasetId="farmland-use" />
```

"The rules" are the **data contract**: which columns a table must have for each
chart type. They are written down in
[visualisation-data-contract.md](visualisation-data-contract.md). If a file
breaks them, the chart shows a message saying which line is wrong instead of
drawing something misleading.

## Where things are

**The data** — `backend/app/data/lake/`

| File | What it is |
|---|---|
| `datasets.json` | The list of datasets: id, chart type, file name, title, unit, source |
| `farmland-use.csv` | The example table for the line chart |
| `arable-land-use.csv` | The example table for the pie chart |

**Backend (Python)** — `backend/app/viz/`

| File | What it does |
|---|---|
| `contract.py` | The rules: required columns per chart type, and the check |
| `lake.py` | Reads `datasets.json` and the CSV files |
| `api.py` | Makes the data available at `/api/viz/...` |
| `transform.py` | Reshapes messy source tables into the contract shape |

Also: `backend/scripts/ingest_farmland_use.py` and `ingest_arable_land_use.py`
(they turn the Excel source into the two CSVs) and `backend/tests/test_viz.py`
(automatic checks for all of the above).

**Frontend (React)** — `Implementation/src/visualisation/`

| File | What it does |
|---|---|
| `VisualisationPanel.jsx` | The one component the main app will use. Picks the chart for the dataset's type |
| `LineChartView.jsx` | Draws the line chart |
| `PieChartView.jsx` | Draws the pie chart |
| `useDataset.js` | Loads a dataset and tracks loading / ready / error |
| `api.js` | Asks the backend for a dataset |
| `visualisation.css` | Colours and layout, limited to the panel |
| `dev.jsx` + `Implementation/visualisation.html` | The test page |

**Existing files that changed** — only two, and neither affects the screen:

- `backend/app/main.py`: three lines that switch on the `/api/viz` addresses.
- `Implementation/package.json` (and `package-lock.json`): adds the chart
  library `recharts`. The main app does not load it.

## Try it

1. Start the app as usual (double-click `run.bat`, or see the main README).
   If you pulled this branch, run `npm install` in `Implementation/` once first.
2. Open <http://localhost:5173/visualisation.html>. You should see the farmland
   line chart and, below it, the arable land pie chart.
3. Open <http://localhost:5173/> to confirm the main app looks the same as before.

To run the automatic checks: in `backend/`, with the venv active, run `pytest`.

## How to…

### Add a dataset (no programming)

1. Make a CSV with the columns the chart type needs. For a line chart:

   ```
   date,series,value
   2022,Wheat,1200
   2023,Wheat,1350
   ```

   For a pie chart, one row per slice:

   ```
   category,value
   Wheat,1200
   Barley,800
   ```

2. Save it in `backend/app/data/lake/`, for example as `wheat.csv`.
3. Add an entry to `datasets.json` in the same folder:

   ```json
   { "id": "wheat", "type": "line", "file": "wheat.csv", "title": "Wheat harvest", "unit": "t", "source": "Jordbruksverket" }
   ```

4. Run `pytest` in `backend/`. It checks every dataset in the folder.
5. To look at it, open the test page with the id at the end of the address:
   <http://localhost:5173/visualisation.html?dataset=wheat>

Good to know for a pie chart:

- Slices are drawn in the order of the file, clockwise from the top. Put the
  biggest first.
- A pie shows at most six slices. If the file has more rows, the five biggest
  stay and the rest are added up into one grey slice called "Other". Small
  slices in similar colours are hard to tell apart.
- Values cannot be negative.

### Add a dataset from an Excel report

Copy `backend/scripts/ingest_farmland_use.py`, change the sheet name, the row
labels and the output file name at the top, and run it. Then do steps 3–5 above.
This step needs some Python.

### Add a chart type (bubble map)

The pie chart was added this way; its files are a good example to copy.

1. `backend/app/viz/contract.py`: add the type and its columns to `CHART_TYPES`.
2. `Implementation/src/visualisation/`: write the component (like
   `PieChartView.jsx`) and add it to `CHARTS` in `VisualisationPanel.jsx`.
3. Add an example dataset (see "Add a dataset" above) and put its id in
   `EXAMPLES` in `dev.jsx`, so it shows on the test page.
4. Add tests in `backend/tests/test_viz.py`.
5. Update this guide and the data contract.

### Put a chart in the main app

Not done yet, on purpose. When the team agrees where it goes, it is one line in
that place:

```jsx
<VisualisationPanel datasetId="farmland-use" />
```

## Words used here

- **Data lake**: the folder where the data files are kept.
- **Manifest**: `datasets.json`, the list of what is in that folder.
- **Tidy table**: one measurement per row (not one column per year).
- **Contract**: the agreed column names per chart type.
- **Backend / frontend**: the Python program that serves data / the web page
  that shows it.
- **API**: the web addresses the frontend uses to ask the backend for data.
- **Component**: a reusable piece of the web page, here the chart panel.

## Still to decide

See "Decisions" and "Open questions for the team" at the end of the
[data contract](visualisation-data-contract.md).
