# Visualisation data contract

Status: draft, to be agreed with the team. The code that enforces it is
`backend/app/viz/contract.py`; if this document and that file disagree, the
code is what runs.

New here? Read [visualisation-guide.md](visualisation-guide.md) first; it explains
the same things in plain language.

## Data lake

The lake is a folder of CSV files plus one manifest, `datasets.json`.
Default location: `backend/app/data/lake/`. Set the environment variable
`VIZ_DATA_DIR` to point the backend at another folder.

Every CSV is UTF-8, comma-separated, with a header row, a `.` decimal point and
no thousands separators. Files are "tidy": one observation per row.

## Chart types and their columns

| Type | Chart | Required columns |
|---|---|---|
| `line` | Line chart (time series) | `date`, `series`, `value` |
| `pie` | Pie chart | `category`, `value` |
| `bubble-map` | Bubble map | `name`, `lat`, `lon`, `value` |

- `value`, `lat`, `lon` are numbers. `lat`/`lon` are WGS84 decimal degrees.
- `date` is a year (`2024`) or an ISO date (`2024-03-31`), consistent within a file.
- `series`, `category`, `name` are free text and are shown to the user as written.
- Extra columns are allowed and are passed through untouched.
- A `(date, series)` pair, a `category` or a `name` may appear only once per file.
- `lat` must be between -90 and 90, `lon` between -180 and 180.
- In a `pie` or `bubble-map` file, `value` may not be negative.

All three types are implemented.

A pie chart shows at most six slices, in file order. With more rows than that,
the frontend keeps the five biggest and adds the rest up into one "Other" slice.
The file itself may have any number of rows.

A bubble map draws one circle per row at (`lat`, `lon`). The circle's area is
proportional to `value`, scaled so the largest value in the file gets the
largest circle.

## Manifest

`datasets.json` is a list with one entry per dataset:

```json
{
  "id": "farmland-use",
  "type": "line",
  "file": "farmland-use.csv",
  "title": "Farmland in Östergötland",
  "subtitle": "Area by land type, hectares",
  "unit": "ha",
  "source": "Jordbruksverket"
}
```

`id`, `type`, `file` and `title` are required.

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/viz/datasets` | The manifest entries (without `file`) |
| GET | `/api/viz/datasets/{id}` | One manifest entry plus `rows`, the validated CSV rows as JSON |

Errors: `404` for an unknown id, `500` with a readable `detail` when a file is
missing or breaks the contract.

## Host UI

The host renders one React component and gives it a sized container:

```jsx
import VisualisationPanel from './visualisation/VisualisationPanel.jsx';

<VisualisationPanel datasetId="farmland-use" />
```

## Decisions

- **The data lake holds tidy CSV files only**, in the shape described above.
  Raw source files (Excel reports etc.) stay outside the lake; scripts in
  `backend/scripts/` turn them into tidy CSVs.
- **The bubble map is its own small map inside the panel**, not a layer on the
  main app's map (issue #25). It works wherever the panel is placed and leaves
  the main UI unchanged. Its background map is loaded from the same online
  service as the main map.

## Open questions for the team

1. Where does the lake live in the deployed app, and who writes to it?

## Grows with new features

What the host UI passes to `VisualisationPanel` besides `datasetId`. Today it
is only the id. Further inputs (for example filters or the selected scenario)
get added here as features need them, each documented when it is added.
