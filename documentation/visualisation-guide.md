# Data overview: start here

This guide explains the data overview window: what it is, where the files
are, and how to do the common tasks. You do not need to read the code first.

## What it does

The data overview is Window 3 of the app, between **Data Lake** and
**Visualization**. It shows each dataset you selected in the Data Lake as a
**stack of cards**. Each card is one small chart. Turn the cards with the
mouse wheel, the arrow keys or the ‹ › buttons.

There are three chart types:

- a line chart (for example farmland area in Östergötland over time),
- a pie chart (for example arable land in Östergötland by crop),
- a bubble map (for example how much of the fresh vegetables each
  municipality buys is Swedish).

## How the data travels

```
 Excel file from a report                      (outside the repository)
        │   an ingest script reshapes it (run once, by hand)
        ▼
 Upload folder: data.csv + metadata.json       (outside the repository)
        │   uploaded in the Data Lake window
        ▼
 Dataset in the data lake                      selected with its checkbox
        │   "To Overview →"
        ▼
 /overview?selection=…                         one card stack per dataset
        │   "To Visualization →"
        ▼
 Visualization window, then Simulation
```

The overview only draws a dataset whose file has the right columns for a
chart type. Those rules are the **data contract**, written down in
[visualisation-data-contract.md](visualisation-data-contract.md). If a file
breaks them, the overview shows a message saying which line is wrong instead
of drawing something misleading. Selected datasets that are not in a chart
format are listed at the top and skipped. They stay in the selection for the
next windows.

## Where things are

**Backend (Python)**: `backend/app/viz/`

| File | What it does |
|---|---|
| `contract.py` | The rules: required columns per chart type, and the check |
| `lake.py` | Reads selected datasets from the data lake and picks the chart type from the column names |
| `views.py` | Cuts a dataset into cards (views) |
| `api.py` | Makes it available at `/api/viz/...`, for signed-in users only |
| `export.py` | Writes an upload folder (CSV + `metadata.json`) for the ingest scripts |
| `transform.py` | Reshapes messy source tables into the contract shape |
| `places.py` | Looks up the position of a municipality or town |

Also: the four `ingest_*.py` scripts and `build_places.py` in
`backend/scripts/`, the place table in `backend/app/data/reference/`, and
`backend/tests/test_viz.py` (automatic checks for all of the above).

**Frontend (React)**: `frontend/src/visualisation/` and one page

| File | What it does |
|---|---|
| `../pages/OverviewPage.jsx` | The window: header with Back / To Visualization, skipped datasets, the overview |
| `DataOverview.jsx` | The grid of card stacks for one selection |
| `CardStack.jsx` | One dataset as a stack of cards |
| `useViewStack.js` | Loads the cards ten at a time |
| `LineChartView.jsx`, `PieChartView.jsx`, `BubbleMapView.jsx` | Draw the charts |
| `charts.js` | Chart type → component |
| `api.js` | Asks the backend for the data, signed in |
| `visualisation.css`, `overview.css` | Colours and layout, limited to the overview |

**Existing files that changed**

- `frontend/src/main.jsx`: the `/overview` route.
- `frontend/src/pages/DataLakePage.jsx`: the button is now **To Overview →**.
- `frontend/src/pages/VisualizationPage.jsx`: the back link goes to the overview.
- `frontend/package.json`: adds the chart library `recharts`.
- `backend/app/main.py`: switches on the `/api/viz` routes.

## Try it

1. Start the app as usual (double-click `run.bat`, or see the main README).
   If you pulled this branch, run `npm install` in `frontend/` once first.
2. Make the upload folders from the report's workbooks (see "Add a dataset
   from an Excel report" below), or write a small CSV by hand.
3. Sign in, open the Data Lake, click **Upload** and add the CSV together
   with its `metadata.json`.
4. Tick the new datasets and click **To Overview →**.

To run the automatic checks: in `backend/`, with the venv active, run `pytest`.

## How to…

### Add a dataset by hand

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

   For a bubble map, one row per place, with its position:

   ```
   name,lat,lon,value
   Linköping,58.41,15.62,1200
   Norrköping,58.59,16.18,950
   ```

2. Write its `metadata.json`. The Data Lake's upload dialog offers a
   template. The overview uses `title`, `description` (as the subtitle),
   `source.organization`, and the `unit` of the `value` column.
3. Upload both in the Data Lake, select the dataset and open the overview.

Good to know for a pie chart:

- Slices are drawn in the order of the file, clockwise from the top. Put the
  biggest first.
- A pie shows at most six slices. If the file has more rows, the five biggest
  stay and the rest are added up into one grey slice called "Other".
- Values cannot be negative.

Good to know for a bubble map:

- `lat` and `lon` are the place's position in decimal degrees (for Linköping
  about `58.41` and `15.62`). `lat` is north–south, `lon` is east–west.
  Swapping them puts the circles in the wrong country.
- Size and colour go from the lowest to the highest value in the file. The
  key in the corner shows the real lowest and highest values.
- Values cannot be negative.
- The background map comes from the internet, so it needs a connection.
- To zoom, use the + and − buttons. The mouse wheel turns the cards.

### Add a dataset from an Excel report

Each `ingest_*.py` script in `backend/scripts/` reads one workbook and writes
an upload folder. For example, from `backend/` with the venv active:

```
pip install openpyxl
python scripts/ingest_farmland_use.py "<path to 1. Datainsamling Primärproduktion.xlsx>" "<output folder>"
```

This writes `<output folder>/farmland-use/farmland-use.csv` and
`metadata.json`. **Keep the output folder outside the repository**: data
files do not go into git. Then upload both files in the Data Lake.

For a new workbook, copy `ingest_farmland_use.py` and change the sheet name,
the row labels, the dataset id and the metadata. This needs some Python.

For a map, the sheet usually names places but has no coordinates. Look them up
with `municipality()` or `town()` from `backend/app/viz/places.py`, as
`ingest_swedish_vegetables.py` does. The table behind it
(`backend/app/data/reference/places.csv`) is still a **placeholder**: not yet
reviewed, and it has towns for Östergötland only. See the README next to it.

### Add a chart type

The pie chart and the bubble map were added this way; their files are good
examples to copy.

1. `backend/app/viz/contract.py`: add the type and its columns to `CHART_TYPES`.
2. `backend/app/viz/lake.py`: add it to `DETECT_ORDER`. Put types whose
   columns include another type's columns first.
3. `frontend/src/visualisation/`: write the component (like
   `PieChartView.jsx`) and add it to `CHARTS` in `charts.js`.
4. Optional: give it views (see below). Without them the overview shows the
   whole dataset on a single card.
5. Add tests in `backend/tests/test_viz.py`.
6. Update this guide and the data contract.

### Cards (views)

- `backend/app/viz/views.py` cuts a dataset into views, such as one line per
  food item or ten places at a time. To give a chart type views, add a
  function to `VIEW_BUILDERS`. It gets the validated rows and returns a list
  of `{"title", "subtitle", "rows"}`. Every view's rows must still meet the
  type's contract.
- `GET /api/viz/datasets/{id}/views?offset=0&limit=10` serves them a page at
  a time. The frontend loads 10, then the next 10 when three are left
  (`useViewStack.js`).
- Look: the stack's tilt, card offsets and animation speed are CSS variables
  at the top of `overview.css`.
- Maps: only the top card draws a live map, because browsers allow only about
  16 WebGL maps at once.

## Words used here

- **Data lake**: where the platform keeps uploaded datasets (the Data Lake window).
- **Selection**: the datasets ticked in the Data Lake, saved under an id that
  goes in the address of Windows 3–5.
- **View**: one card of the data overview: a slice of a dataset small enough
  for one chart.
- **Tidy table**: one measurement per row (not one column per year).
- **Contract**: the agreed column names per chart type.
- **Upload folder**: a CSV plus its `metadata.json`, ready to upload.
- **Backend / frontend**: the Python program that serves data / the web page
  that shows it.
- **API**: the web addresses the frontend uses to ask the backend for data.

## Still to decide

See "Decisions" and "Open questions for the team" at the end of the
[data contract](visualisation-data-contract.md).
