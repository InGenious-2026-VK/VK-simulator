# FoodChainIQ API Reference

**Version:** 1.0 (draft) · **Base URL:** `https://<host>/api` (local dev:
`http://localhost:8000/api`, proxied by Vite at `/api`)

The machine-readable spec is [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1).
The standard dataset metadata file is defined by
[`dataset-metadata.schema.json`](./dataset-metadata.schema.json), and there is
a worked example in [`examples/metadata.example.json`](./examples/metadata.example.json).
For the user-facing behaviour, see
[`../foodchainiq-application-windows.md`](../foodchainiq-application-windows.md).

> **Implementation status.** Endpoints marked **✅ live** exist in `backend/`
> today. Endpoints marked **🛠 planned** are the specification for the Home /
> Data Lake / Visualization windows and are not built yet. Live endpoints only
> gain *optional* fields, so current clients keep working.

---

## Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication-window-1--home)
3. [Users & groups](#3-users--groups)
4. [Datasets (Data Lake)](#4-datasets-window-2--data-lake)
5. [Removal requests](#5-removal-requests)
6. [Standard metadata file](#6-standard-metadata-file)
7. [Selections](#7-selections)
8. [Visualization](#8-visualization-window-3)
9. [Simulation](#9-simulation-window-4)
10. [Admin](#10-admin)
11. [Endpoint index](#11-endpoint-index)

---

## 1. Conventions

**Format.** JSON (`application/json; charset=utf-8`), except uploads
(`multipart/form-data`) and file downloads. Timestamps are ISO 8601 UTC
(`2026-11-17T09:30:00Z`). IDs are prefixed strings (`ds_…`, `sel_…`, `usr_…`,
`grp_…`, `rr_…`, `run_…`).

**Authentication.** Every endpoint except `/health`, `/auth/login`,
`/auth/refresh` and `/stats/public` needs
`Authorization: Bearer <access_token>`.

**Pagination.** List endpoints take `page` (1-based, default 1) and
`page_size` (default 25, max 100), and return:

```json
{ "items": [ ... ], "page": 1, "page_size": 25, "total": 137 }
```

**Errors.** Every error uses one envelope:

```json
{
  "error": {
    "code": "dataset_not_found",
    "message": "Dataset ds_8f2k does not exist or you do not have access to it.",
    "details": { "dataset_id": "ds_8f2k" }
  }
}
```

| HTTP | `code` examples | Meaning |
|---|---|---|
| 400 | `validation_error`, `invalid_metadata`, `metadata_missing` | Malformed request or metadata |
| 401 | `unauthenticated`, `token_expired` | No valid access token |
| 403 | `forbidden`, `visibility_not_allowed` | Signed in but not allowed |
| 404 | `dataset_not_found`, `selection_not_found` | Missing, **or not visible to you** (private datasets never return 403, so their existence is not revealed) |
| 409 | `removal_already_pending`, `dataset_not_ready` | Conflicts with current state |
| 413 | `upload_too_large`, `quota_exceeded` | Size or quota limits |
| 415 | `unsupported_format` | File type not accepted |
| 429 | `rate_limited` | Too many requests (see `Retry-After`) |

**Visibility.** `private` | `group` | `public`. "Public" means every
**signed-in** user. Nothing in the data lake is served to anonymous clients.

---

## 2. Authentication (Window 1 — Home)

The access token is a JWT valid for 15 minutes. The refresh token is stored in
an `httpOnly`, `Secure`, `SameSite=Strict` cookie (`fciq_refresh`), lasts
7 days, and rotates on every refresh.

### `POST /auth/login` 🛠 planned

```json
// request
{ "email": "planner@example.se", "password": "••••••••" }
```

```json
// 200 OK  (+ Set-Cookie: fciq_refresh=…)
{
  "access_token": "eyJhbGciOi…",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "usr_41ab",
    "email": "planner@example.se",
    "display_name": "Regional Planner",
    "role": "user",
    "groups": [{ "id": "grp_lst", "name": "Länsstyrelsen Östergötland" }]
  }
}
```

Returns `401 invalid_credentials` on failure. After 5 failures in 15 minutes
it returns `429 rate_limited`.

### `POST /auth/refresh` 🛠 planned
No body. It reads the `fciq_refresh` cookie and returns the same shape as
login, with a new access token and a rotated cookie.

### `POST /auth/logout` 🛠 planned
Revokes the refresh token and clears the cookie. Returns `204`.

### `GET /auth/me` 🛠 planned
Returns the current `User`, including `groups` and `storage`
(`{ "used_bytes": 1288490188, "quota_bytes": 10737418240 }`). The Home
window uses it to decide whether to show **To data lake**.

### `GET /stats/public` 🛠 planned · no auth
Teaser numbers for the Home page:
`{ "public_datasets": 42, "categories": { "production": 11, "logistics": 7, … } }`.

---

## 3. Users & groups

### `GET /groups` 🛠 planned
Lists the groups the caller belongs to. Platform admins get all groups. The
upload dialog uses it to fill the **Group** picker.

```json
{ "items": [
  { "id": "grp_lst", "name": "Länsstyrelsen Östergötland", "role": "member", "member_count": 14 },
  { "id": "grp_vk",  "name": "Vreta Kluster producers",    "role": "admin",  "member_count": 38 }
], "page": 1, "page_size": 25, "total": 2 }
```

### `GET /groups/{group_id}/members` 🛠 planned
Members of a group the caller belongs to.

### `POST /groups/{group_id}/members` 🛠 planned · group admin
Body `{ "user_id": "usr_…", "role": "member" | "admin" }`. Returns `201`.

### `DELETE /groups/{group_id}/members/{user_id}` 🛠 planned · group admin
Returns `204`. The removed member loses access to the group's datasets
straight away.

---

## 4. Datasets (Window 2 — Data Lake)

### The `Dataset` object

```json
{
  "id": "ds_8f2k",
  "version": 3,
  "title": "Dairy processing capacity 2025",
  "description": "Daily intake and cold-storage capacity of dairies in Östergötland.",
  "category": "processing",
  "keywords": ["dairy", "cold chain"],
  "owner": { "id": "usr_41ab", "display_name": "Regional Planner" },
  "visibility": "group",
  "group": { "id": "grp_vk", "name": "Vreta Kluster producers" },
  "status": "ready",
  "status_reason": null,
  "sensitivity": "internal",
  "license": "CC-BY-4.0",
  "files": [
    { "id": "f_01", "name": "dairies.geojson", "format": "geojson", "size_bytes": 482113, "record_count": 23 },
    { "id": "f_02", "name": "capacity_by_month.csv", "format": "csv", "size_bytes": 10241, "record_count": 276 }
  ],
  "spatial": { "crs": "EPSG:4326", "bbox": [14.9, 57.8, 16.9, 58.9], "has_geometry": true },
  "temporal": { "start": "2025-01-01", "end": "2025-12-31", "resolution": "month" },
  "simulation": { "role": "processing" },
  "removal_request": null,
  "size_bytes": 492354,
  "created_at": "2026-10-02T08:11:00Z",
  "updated_at": "2026-11-10T14:02:00Z",
  "permissions": { "can_edit": true, "can_request_removal": true, "can_download": true }
}
```

`status` is one of `uploading`, `processing`, `ready`, `invalid` or `removed` (after an approved removal; removed datasets are hidden from listings).
`removal_request`, when set, is `{ "id": "rr_…", "status": "pending" }`.

### `GET /datasets` 🛠 planned
The Data Lake grid and list.

| Query | Type | Description |
|---|---|---|
| `scope` | `all` \| `mine` \| `groups` \| `public` | Sidebar view. Default `all` (everything visible to the caller) |
| `q` | string | Full-text search over title, description, keywords |
| `category` | string (repeatable) | `production`, `processing`, `logistics`, `energy`, `water`, `population`, `demand`, `vulnerability`, `other` |
| `format` | string (repeatable) | `csv`, `xlsx`, `geojson`, `gpkg`, `shapefile`, `parquet`, `json` |
| `visibility` | string (repeatable) | Filter by visibility |
| `group_id` | string | Only datasets shared with this group |
| `owner_id` | string | Only datasets of this owner |
| `status` | string | e.g. `ready` |
| `updated_after` | date | |
| `sort` | `updated_at` \| `-updated_at` \| `title` \| `size_bytes` | Default `-updated_at` |
| `page`, `page_size` | int | Pagination |

Returns a paginated list of `Dataset` objects (without `files[].columns`).

### `GET /datasets/{dataset_id}` 🛠 planned
The full `Dataset`, including the parsed metadata and each file's column
profile. Used by the details pane. Returns `404` if the dataset is missing
**or** not visible to the caller.

### `POST /datasets` 🛠 planned — upload a dataset

`multipart/form-data`:

| Part | Required | Description |
|---|---|---|
| `metadata` | ✓, exactly one | The standard metadata file (`metadata.json`), see §6 |
| `files` | ✓, 1–50 | Data files. Repeat the part for each file |
| `visibility` | ✓ | `private` \| `group` \| `public` |
| `group_id` | if `visibility=group` | A group the caller belongs to |

```bash
curl -X POST "$API/datasets" \
  -H "Authorization: Bearer $TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "files=@dairies.geojson" \
  -F "files=@capacity_by_month.csv" \
  -F "visibility=group" \
  -F "group_id=grp_vk"
```

**`202 Accepted`** returns the `Dataset` with `status: "processing"` and a
`Location: /api/datasets/{id}` header. Ingestion runs in the background:
format checks, column profiling, bbox, summary statistics. Poll
`GET /datasets/{id}` until `status` is `ready` or `invalid`.

Validation that happens **before anything is stored**:
- `400 metadata_missing` if there is no metadata part, or more than one;
- `400 invalid_metadata` if the metadata breaks the schema, with per-field
  errors in `details.errors[]`;
- `400 file_mismatch` if a file listed in `metadata.files[]` was not
  uploaded, or an uploaded file is not listed;
- `403 visibility_not_allowed` if `visibility=public` is requested while
  `metadata.sensitivity` is `restricted`, or the caller is not in
  `group_id`;
- `413 upload_too_large` if the upload is over 2 GB, or
  `413 quota_exceeded` if it would exceed the caller's quota;
- `415 unsupported_format`.

> Uploads over 100 MB should use resumable uploads (`POST /uploads`, tus
> protocol). This is reserved for v1.1 and not specified further here.

### `PATCH /datasets/{dataset_id}` 🛠 planned · owner
Changes `title`, `description`, `keywords`, `visibility` and `group_id`.
Changing visibility to `public` follows the same sensitivity rule. Returns the
updated `Dataset`. A visibility change takes effect straight away for every
other user.

### `PUT /datasets/{dataset_id}/files` 🛠 planned · owner
Uploads a new version, using the same multipart parts as `POST /datasets`
apart from `visibility`. `version` goes up by one. Existing selections keep
the version they pinned.

### `GET /datasets/{dataset_id}/files/{file_id}` 🛠 planned
Downloads one file. Returns `302` to a short-lived signed object-storage URL.
Downloads are audit-logged.

### `GET /datasets/{dataset_id}/metadata` 🛠 planned
Returns the original metadata file as uploaded.

### `GET /datasets/{dataset_id}/preview` 🛠 planned
Shows the first rows of each tabular file, or the first features as GeoJSON.
`?file_id=&limit=` (default 20, max 200).

```json
{ "file_id": "f_02", "columns": ["month", "dairy_id", "intake_tpd"],
  "rows": [["2025-01", "d-01", 41.5], ["2025-01", "d-02", 18.0]], "truncated": true }
```

---

## 5. Removal requests

Owners **request** removal and a platform admin decides (see §10). While the
request is pending the dataset stays usable.

### `POST /datasets/{dataset_id}/removal-requests` 🛠 planned · owner

```json
// request
{ "reason": "Superseded by the 2026 survey; contains an outdated facility list." }
```

```json
// 201 Created
{
  "id": "rr_7c1d",
  "dataset": { "id": "ds_8f2k", "title": "Dairy processing capacity 2025" },
  "requested_by": { "id": "usr_41ab", "display_name": "Regional Planner" },
  "reason": "Superseded by the 2026 survey; contains an outdated facility list.",
  "status": "pending",
  "decision_note": null,
  "created_at": "2026-11-17T09:30:00Z",
  "decided_at": null
}
```

Returns `403 forbidden` if the caller is not the owner, or
`409 removal_already_pending`.

### `GET /removal-requests` 🛠 planned
The caller's own requests (the *Removal requests* sidebar view).
`?status=pending|approved|rejected|cancelled`.

### `GET /removal-requests/{request_id}` 🛠 planned
One request.

### `POST /removal-requests/{request_id}/cancel` 🛠 planned · requester
Only allowed while the request is `pending`. Returns the request with
`status: "cancelled"`.

**Outcome of approval:** the dataset gets `status: "removed"` and disappears
from every list, search and selection. Past simulation runs keep a tombstone
reference (ID, title, version). Files are purged after 30 days.

---

## 6. Standard metadata file

Every dataset upload includes **one** `metadata.json` that conforms to
[`dataset-metadata.schema.json`](./dataset-metadata.schema.json) (JSON
Schema 2020-12). It describes the dataset as a whole and each of its files.
Its key fields are listed below.

| Field | Req. | Description |
|---|:-:|---|
| `schema_version` | ✓ | `"1.0"` |
| `title` | ✓ | Human-readable name (3–200 chars) |
| `description` | ✓ | What the data is and how it was produced |
| `category` | ✓ | Platform data layer: `production`, `processing`, `logistics`, `energy`, `water`, `population`, `demand`, `vulnerability`, `other` |
| `keywords` | | Free tags |
| `source` | ✓ | `{ organization, url?, collected_at?, method? }`: provenance |
| `license` | ✓ | SPDX ID (`CC-BY-4.0`, `CC0-1.0`, …) or `"proprietary"` |
| `contact` | | `{ name, email }` of the data steward |
| `sensitivity` | ✓ | `open` \| `internal` \| `restricted`. `restricted` can never be public (concept doc §9) |
| `spatial` | | `{ crs, bbox?, region?, geometry_type? }` |
| `temporal` | | `{ start, end, resolution }` |
| `files` | ✓ | One entry per uploaded data file: `{ name, format, description?, columns?[] }` |
| `files[].columns[]` | | `{ name, type, unit?, description?, role? }`. `type` ∈ `string`, `integer`, `number`, `boolean`, `date`, `datetime`, `geometry` |
| `simulation` | | `{ role, mapping? }`: how the simulator uses the data (§9.1) |

`GET /metadata/template` 🛠 planned returns a pre-filled template to edit.
`POST /metadata/validate` 🛠 planned checks a metadata file (JSON body or
multipart `metadata`) without uploading anything:

```json
{ "valid": false, "errors": [
  { "path": "/files/0/format", "message": "must be one of csv, xlsx, geojson, gpkg, shapefile, parquet, json" },
  { "path": "/license",        "message": "is required" }
] }
```

---

## 7. Selections

A selection is the set of datasets passed from the Data Lake to the
Visualization and Simulation windows.

### `POST /selections` 🛠 planned

```json
// request
{ "dataset_ids": ["ds_8f2k", "ds_p0p1", "ds_r0ad"] }
```

```json
// 201 Created
{
  "id": "sel_3hq9",
  "datasets": [
    { "id": "ds_8f2k", "version": 3, "title": "Dairy processing capacity 2025", "simulation_role": "processing" },
    { "id": "ds_p0p1", "version": 1, "title": "Population SCB 2024",            "simulation_role": "population" },
    { "id": "ds_r0ad", "version": 2, "title": "E4 / road 34 corridors",          "simulation_role": "logistics" }
  ],
  "created_by": "usr_41ab",
  "created_at": "2026-11-17T09:31:00Z",
  "expires_at": "2026-12-17T09:31:00Z"
}
```

Rules: 1–20 datasets, each `ready` and visible to the caller
(`409 dataset_not_ready` / `404`). The selection **pins** each dataset's
current version.

### `GET /selections/{selection_id}` 🛠 planned
Returns the selection. Access is checked again: datasets the caller can no
longer see are moved to `"unavailable": [{ "id", "reason" }]`. Selections can
be opened by anyone who can see all of their datasets, so a link can be shared
with colleagues.

---

## 8. Visualization (Window 3)

### `GET /visualizations/summary?selection_id={id}` 🛠 planned

The server computes the summary and caches it per selection. Response
(abridged):

```json
{
  "selection_id": "sel_3hq9",
  "generated_at": "2026-11-17T09:31:04Z",
  "overview": {
    "dataset_count": 3,
    "total_records": 1824,
    "features_with_geometry": 311,
    "time_span": { "start": "2024-01-01", "end": "2025-12-31" },
    "combined_bbox": [14.6, 57.7, 16.9, 58.9],
    "municipalities_covered": 13
  },
  "datasets": [
    {
      "id": "ds_8f2k",
      "title": "Dairy processing capacity 2025",
      "category": "processing",
      "simulation_role": "processing",
      "record_count": 299,
      "bbox": [14.9, 57.8, 16.9, 58.9],
      "fields": [
        { "name": "intake_tpd", "type": "number", "unit": "t/day",
          "missing_pct": 1.3, "min": 2.0, "max": 96.5, "mean": 31.4,
          "histogram": { "bins": [0, 20, 40, 60, 80, 100], "counts": [6, 9, 4, 3, 1] } },
        { "name": "type", "type": "string", "missing_pct": 0,
          "top_values": [{ "value": "dairy", "count": 14 }, { "value": "cheese", "count": 9 }] }
      ],
      "charts": [
        { "kind": "timeseries", "title": "Total intake by month",
          "x": "month", "y": "intake_tpd", "agg": "sum",
          "data": [["2025-01", 721.0], ["2025-02", 698.5]] },
        { "kind": "point_map", "title": "Facility locations", "geometry_url": "/api/datasets/ds_8f2k/geometry?simplify=0.001" }
      ]
    }
  ],
  "cross_checks": [
    { "level": "warning", "code": "role_conflict", "message": "Two datasets declare role 'population'." }
  ],
  "simulation_readiness": {
    "production": "baseline",
    "processing": "dataset:ds_8f2k",
    "logistics":  "dataset:ds_r0ad",
    "energy":     "baseline",
    "population": "dataset:ds_p0p1"
  }
}
```

`charts[].kind` ∈ `timeseries`, `bar`, `histogram`, `point_map`,
`choropleth`, `table`. The server picks charts from the column types and
roles. The frontend renders them with the shared chart primitives.

### `GET /datasets/{dataset_id}/summary` 🛠 planned
The same `datasets[]` entry, for a single dataset (used by the Data Lake
details pane).

### `GET /datasets/{dataset_id}/geometry` 🛠 planned
GeoJSON `FeatureCollection` of the dataset's spatial features for map
display. `?file_id=&simplify=<tolerance in degrees>&bbox=minx,miny,maxx,maxy&limit=`.
Returns `404 no_geometry` if the dataset has no spatial component.

---

## 9. Simulation (Window 4)

The current simulation API stays unchanged and gains optional dataset
support.

### `GET /health` ✅ live
`{ "status": "ok", "nodes": 41, "edges": 63, "total_demand_tpd": 512.4 }`

### `GET /network` ✅ live · extended 🛠
The baseline network (nodes, edges, coordinates). **Planned:** an optional
`?selection_id=` returns the network *merged* with the selection (see §9.1),
with `meta.sources` listing which dataset each node or edge came from.

### `GET /presets` ✅ live
Named example scenarios.

### `GET /simulation/context?selection_id={id}` 🛠 planned
Shows the Simulation window how a selection maps onto the model, before any
run:

```json
{
  "selection_id": "sel_3hq9",
  "inputs": {
    "production": { "source": "baseline" },
    "processing": { "source": "dataset", "dataset_id": "ds_8f2k", "version": 3, "nodes_added": 4, "nodes_replaced": 19 },
    "logistics":  { "source": "dataset", "dataset_id": "ds_r0ad", "version": 2, "edges_replaced": 22 },
    "energy":     { "source": "baseline" },
    "population": { "source": "dataset", "dataset_id": "ds_p0p1", "version": 1, "nodes_replaced": 13 }
  },
  "map_layers": [
    { "dataset_id": "ds_8f2k", "title": "Dairy processing capacity 2025", "geometry_url": "/api/datasets/ds_8f2k/geometry" }
  ],
  "warnings": []
}
```

### `POST /simulate` ✅ live · extended 🛠

Runs a scenario. The live body is unchanged. Planned addition: an optional
`selection_id`.

```jsonc
{
  "name": "E4 closure, winter",
  "duration_days": 14,
  "selection_id": "sel_3hq9",          // 🛠 optional: omit for the synthetic baseline
  "disruptions": [
    { "kind": "edge_closure",     "edge_id": "e4-nkpg-cold-to-lkpg-dc" },
    { "kind": "node_outage",      "node_id": "proc-norrkoping-mill", "capacity_factor": 0.0 },
    { "kind": "energy_outage",    "node_id": "e-linkoping-sub",      "backup_factor": 0.1 },
    { "kind": "production_shock", "factor": 0.6 },
    { "kind": "fuel_shortage",    "factor": 0.35 }
  ]
}
```

`factor`, `capacity_factor` and `backup_factor` are **remaining fractions**
(0 = gone, 1 = unaffected). The response is the existing `SimulationResult`
(per-town impact plus a day-by-day timeline; see `backend/README.md`). The
planned version adds:

```json
{ "...": "...",
  "run_id": "run_x81q",
  "inputs": { "selection_id": "sel_3hq9",
              "datasets": [{ "id": "ds_8f2k", "version": 3 }, { "id": "ds_p0p1", "version": 1 }] } }
```

### `GET /simulations` / `GET /simulations/{run_id}` 🛠 planned
History of the caller's runs (fills the "recent runs" list, currently sample
data). Each run stores its scenario and the pinned dataset versions, so it can
be reproduced.

### 9.1 How datasets feed the model

The simulator reads `metadata.simulation.role`, then uses
`metadata.simulation.mapping` to map the dataset's columns onto network
fields:

| Role | Becomes | Required mapped fields | Optional |
|---|---|---|---|
| `production` | `farm` / supply nodes | `id`, `geometry`, `production_tpd` | `name` |
| `processing` | `processing` / `storage` nodes | `id`, `geometry`, `capacity_tpd` | `stock_tonnes`, `depends_on`, `type` |
| `logistics` | edges | `id`, `source`, `target`, `capacity_tpd` | `distance_km`, `mode` |
| `energy` | `substation` nodes | `id`, `geometry` | `serves` (list of node IDs → `depends_on`) |
| `population` / `demand` | `town` nodes | `id` or `municipality_code`, `population` | `demand_tpd`, `local_stock_days` |
| `reference` | map layer only | — | — |

Example mapping, from `examples/metadata.example.json`:

```json
"simulation": {
  "role": "processing",
  "mapping": { "file": "dairies.geojson", "id": "facility_id", "name": "name",
               "capacity_tpd": "intake_tpd", "stock_tonnes": "cold_storage_t" }
}
```

Records whose `id` matches a baseline node or edge **replace** it. Others are
**added** and snapped to the nearest town or corridor node. Roles the
selection does not cover use the synthetic baseline.

---

## 10. Admin

Platform admins only (`role: "admin"`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/removal-requests?status=pending` | Queue of removal requests |
| POST | `/admin/removal-requests/{request_id}/decision` | `{ "decision": "approve" \| "reject", "note": "…" }` |
| GET | `/admin/users` · POST `/admin/users` | List / invite users (`{ email, display_name, role }`) |
| PATCH | `/admin/users/{user_id}` | Change role, quota, or disable |
| POST | `/admin/groups` | Create a group `{ name, description }` |
| GET | `/admin/audit-log` | `?actor_id=&dataset_id=&action=&from=&to=` |

Audit actions: `login`, `dataset.upload`, `dataset.update`,
`dataset.visibility_change`, `dataset.download`, `removal.request`,
`removal.decision`, `simulation.run`.

---

## 11. Endpoint index

| Method | Path | Window | Status |
|---|---|---|---|
| POST | `/auth/login` | 1 Home | 🛠 |
| POST | `/auth/refresh` | all | 🛠 |
| POST | `/auth/logout` | all | 🛠 |
| GET | `/auth/me` | all | 🛠 |
| GET | `/stats/public` | 1 Home | 🛠 |
| GET | `/groups` | 2 Data Lake | 🛠 |
| GET / POST | `/groups/{id}/members` | 2 Data Lake | 🛠 |
| DELETE | `/groups/{id}/members/{user_id}` | 2 Data Lake | 🛠 |
| GET | `/datasets` | 2 Data Lake | 🛠 |
| POST | `/datasets` | 2 Data Lake | 🛠 |
| GET / PATCH | `/datasets/{id}` | 2 Data Lake | 🛠 |
| PUT | `/datasets/{id}/files` | 2 Data Lake | 🛠 |
| GET | `/datasets/{id}/files/{file_id}` | 2 Data Lake | 🛠 |
| GET | `/datasets/{id}/metadata` | 2 Data Lake | 🛠 |
| GET | `/datasets/{id}/preview` | 2 Data Lake | 🛠 |
| POST | `/datasets/{id}/removal-requests` | 2 Data Lake | 🛠 |
| GET | `/removal-requests` · `/removal-requests/{id}` | 2 Data Lake | 🛠 |
| POST | `/removal-requests/{id}/cancel` | 2 Data Lake | 🛠 |
| GET | `/metadata/template` | 2 Data Lake | 🛠 |
| POST | `/metadata/validate` | 2 Data Lake | 🛠 |
| POST | `/selections` | 2 → 3 | 🛠 |
| GET | `/selections/{id}` | 3, 4 | 🛠 |
| GET | `/visualizations/summary` | 3 Visualization | 🛠 |
| GET | `/datasets/{id}/summary` | 2, 3 | 🛠 |
| GET | `/datasets/{id}/geometry` | 3, 4 | 🛠 |
| GET | `/health` | — | ✅ |
| GET | `/network` | 4 Simulation | ✅ (+🛠 `selection_id`) |
| GET | `/presets` | 4 Simulation | ✅ |
| GET | `/simulation/context` | 4 Simulation | 🛠 |
| POST | `/simulate` | 4 Simulation | ✅ (+🛠 `selection_id`) |
| GET | `/simulations` · `/simulations/{run_id}` | 4 Simulation | 🛠 |
| * | `/admin/...` | Admin | 🛠 |
