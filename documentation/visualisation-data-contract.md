# Visualisation data contract

Status: draft, to be agreed with the team. The code that enforces it is
`backend/app/viz/contract.py`; if this document and that file disagree, the
code is what runs.

New here? Read [visualisation-guide.md](visualisation-guide.md) first; it explains
the same things in plain language.

## Where the data comes from

The data overview (Window 3, `/overview?selection=…`) shows the datasets the
user selected in the Data Lake window. They are ordinary platform datasets:
one or more data files plus `metadata.json`, uploaded in the Data Lake (see
[api/README.md](api/README.md)). The platform's access rules apply: a user
only sees datasets they may see.

No data files are kept in the repository. The ingest scripts in
`backend/scripts/` write upload folders outside it (see below).

## Chart types and their columns

A dataset can be drawn when one of its files has the columns of a chart type.
The type is detected from the column names, in this order:

| Type | Chart | Required columns |
|---|---|---|
| `bubble-map` | Bubble map | `name`, `lat`, `lon`, `value` |
| `line` | Line chart (time series) | `date`, `series`, `value` |
| `pie` | Pie chart | `category`, `value` |

The first file of the dataset that matches is drawn. Datasets with no
matching file are listed as skipped; they stay in the selection.

- `value`, `lat`, `lon` are numbers. `lat`/`lon` are WGS84 decimal degrees.
- `date` is a year (`2024`) or an ISO date (`2024-03-31`), consistent within a file.
- `series`, `category`, `name` are free text and are shown to the user as written.
- Extra columns are allowed and are passed through untouched.
- A `(date, series)` pair, a `category` or a `name` may appear only once per file.
- `lat` must be between -90 and 90, `lon` between -180 and 180.
- In a `pie` or `bubble-map` file, `value` may not be negative.

A pie chart shows at most six slices, in file order. With more rows than that,
the frontend keeps the five biggest and adds the rest up into one "Other" slice.
The file itself may have any number of rows.

A bubble map draws one circle per row at (`lat`, `lon`).

## What comes from metadata.json

| Shown as | Taken from |
|---|---|
| Title | `title` |
| Subtitle | `description` |
| Source | `source.organization` |
| Unit | `unit` of the `value` column in the file's `columns` list |

## API

All routes need a signed-in user.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/viz/selections/{id}/datasets` | `{selection_id, datasets, skipped}`. `datasets`: the selected datasets that can be drawn, as `{id, version, type, title, subtitle, unit, source}`. `skipped`: `{id, title, reason, message?}` with `reason` = `not_chartable`, `removed` or `access_revoked` |
| GET | `/api/viz/datasets/{id}?version=` | One dataset as above, plus `rows`, the validated rows |
| GET | `/api/viz/datasets/{id}/views?version=&offset=0&limit=10` | One page of the dataset's views (the cards): `{dataset, total, offset, views}`. `limit` is 1–50 |

`version` is optional; the overview passes the version the selection pinned.

Errors use the platform's envelope `{"error": {"code", "message", "details"}}`:
`404` for an unknown or hidden dataset or selection, `422` with code
`not_chartable` and a readable message (naming the line) when a file breaks
the contract.

## Upload folders from source workbooks

`backend/scripts/ingest_*.py` turn the Excel workbooks of the report
"Kartläggning av Östergötlands livsmedelssystem" into contract-shaped tables.
Each writes `<output folder>/<dataset id>/<dataset id>.csv` and a
`metadata.json` that passes the platform's validation
(`backend/app/viz/export.py`). Upload both files in the Data Lake window.

The metadata says `"license": "proprietary"` and `"sensitivity": "internal"`
until someone has checked the source's terms of use.

## Decisions

- **The data overview is its own window, between Data Lake and Visualization**
  (decided 2026-11-22). Data Lake's button leads to it; it leads on to
  Visualization with the same selection.
- **Its data is the platform's data lake**, not a separate folder of files
  (decided 2026-11-22, after review of PR #28). Data files are uploaded, not
  committed.
- **The chart type is detected from column names**, so `metadata.json` needs
  no new field and the upload works unchanged.
- **The place master table stays in the repository**
  (`backend/app/data/reference/places.csv`). It is reference data the ingest
  scripts use to look up coordinates, not a dataset. It is still a placeholder
  until reviewed (issue #30).
- **The bubble map is its own small map inside the card**, not a layer on the
  simulation's map (issue #25). Its background map is loaded from the same
  online service as the main map.
- **Bubble map: size and colour are scaled between the lowest and the highest
  value**, not from zero (decided 2026-11-17). Each place gets a level from 5%
  (lowest) to 100% (highest) in 1% steps; the level sets the circle's area and
  its colour, light pink to dark red. Circles carry no name labels; the tooltip
  names a place. This makes differences easy to see, at the cost of
  exaggerating them, so the legend always shows the real lowest and highest
  values.

## Open questions for the team

1. Should `metadata.json` get an explicit field for the chart type, for files
   whose columns cannot be renamed?
2. Who checks the licence of the Jordbruksverket figures before the datasets
   are made public?
