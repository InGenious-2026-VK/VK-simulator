# FoodChainIQ backend

The FastAPI service behind all four FoodChainIQ windows:

| Window | What the backend does |
|---|---|
| 1 · Home | Email/password sign-in, JWT access tokens and rotating refresh-token cookies, public catalogue stats |
| 2 · Data Lake | Dataset catalogue with private / group / public visibility; multi-file uploads with a standard `metadata.json`; background ingestion (format checks, column profiling, bounding box, charts); versions, previews and downloads; removal requests that a platform admin approves or rejects; groups; audit log |
| 3 · Visualization | Selections (a pinned list of dataset versions) and server-side summaries: KPIs, coverage, field profiles, charts, cross-dataset checks, simulation readiness |
| 4 · Simulation | The disruption simulator. It runs on the synthetic baseline network or on the baseline **merged with the selected datasets**. Signed-in users' runs are stored. |

The full API reference is `../documentation/api/README.md`, with the
OpenAPI spec in `../documentation/api/openapi.yaml`. When the server is
running, interactive docs are at http://localhost:8000/docs.

## Stack

- **FastAPI** + **uvicorn** — HTTP API
- **SQLAlchemy 2** + **psycopg 3** — PostgreSQL. Tables are created on startup; there are no migrations yet.
- **PyJWT** + **bcrypt** — auth
- **jsonschema** — validation of the metadata file (`app/schemas/`, a copy of the one in `documentation/api/`)
- **openpyxl** — XLSX reading
- **networkx** — minimum-cost flow solver (`network_simplex`)
- **pytest** — tests

## Run

You need PostgreSQL first. From the repo root:

```bash
docker compose up -d db
```

Then, from `backend/`, create the venv:

```bash
python -m venv .venv
```

Activate it. On macOS or Linux:

```bash
source .venv/bin/activate
```

On Windows, run `.venv\Scripts\activate` instead. Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

Configuration comes from environment variables or `backend/.env` (see
[`.env.example`](.env.example)): `DATABASE_URL`, `STORAGE_DIR`, `JWT_SECRET`,
cookie settings, the first admin's credentials, `SEED_DEMO` and upload limits.
**Set `JWT_SECRET` and `ADMIN_PASSWORD` for anything other than local
development.**

On startup the service:

1. creates missing tables;
2. creates the platform admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) if it is
   missing;
3. if `SEED_DEMO=true` and the database has no datasets, seeds two demo users,
   two groups and five synthetic datasets (one per simulation role), so the
   whole Data Lake → Visualization → Simulation flow works straight away;
4. purges the stored files of datasets that were removed more than 30 days ago.

The frontend (`../frontend`) proxies `/api` to `http://127.0.0.1:8000`.

## Docker

`Dockerfile` builds the production image: Python 3.13 slim, running uvicorn
as an unprivileged user, with uploads on the `/data` volume. A health check
calls `/api/health`. Use it through the root `docker-compose.yml` (see the root
README, "Deploy with Docker").

## Storage

Uploaded files go to `STORAGE_DIR` (default `backend/storage/`, gitignored):

```
storage/datasets/<dataset_id>/v<version>/<file name>
```

Metadata, access control, versions, profiles, selections, runs and the audit
log are kept in PostgreSQL. Removing a dataset (once an admin approves) hides it
straight away. Its files are deleted after 30 days.

## Code map

```
app/
  main.py          app, CORS, error handlers, router wiring, startup (tables + seed)
  config.py        settings from env / .env
  db.py, orm.py    engine/session; tables (users, groups, datasets, versions, files,
                   removal_requests, selections, simulation_runs, audit_log, …)
  security.py      bcrypt, JWT, refresh tokens, auth dependencies
  access.py        visibility rules (private / group / public) + audit helper
  metadata.py      metadata.json validation + template
  datasets.py      upload checks, file storage, ingestion, serialisers
  ingest.py        CSV / XLSX / JSON / GeoJSON readers, column profiling, chart picking
  merge.py         selection → simulation network (role mapping, replace / add + snap)
  seed.py          admin + demo users, groups, synthetic datasets
  routers/         auth, groups, datasets (+ removal requests), removal, metadata,
                   selections (+ visualization summary), simulation, admin
  network.py, simulation.py, models.py, presets.py   the simulation engine (unchanged model)
```

## Supported upload formats

| Format | Stored | Profiled, charted, previewed | Map geometry | Simulation input |
|---|:-:|:-:|:-:|:-:|
| CSV / TSV | ✓ | ✓ | from `lat` / `lon` columns (or columns with role `latitude` / `longitude`) | ✓ |
| XLSX (first sheet) | ✓ | ✓ | as CSV | ✓ |
| GeoJSON | ✓ | ✓ | ✓ | ✓ (points; other geometry types use the mean of their vertices) |
| JSON (array / `{"data": [...]}`) | ✓ | ✓ | as CSV | ✓ |
| GeoPackage, zipped Shapefile, Parquet | ✓ | — (needs GDAL / Arrow) | — | — |

## Tests

The tests run against a real PostgreSQL database, which is dropped and
recreated on every run. The default is `foodchainiq_test` on localhost;
override it with `TEST_DATABASE_URL`. Create it once:

```bash
createdb -h localhost -U foodchainiq foodchainiq_test
```

Then, from `backend/`:

```bash
pytest -q
```

`tests/test_api.py` walks the whole flow: sign-in, visibility rules, upload
validation, ingestion, versions, removal requests and the admin decision,
selections, the visualization summary, the merged network, and stored
simulation runs. `tests/test_simulation.py` and `tests/test_network.py` cover
the engine.

## Simulation API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | — | Liveness + network size |
| GET | `/api/network` | — (needed with `selection_id`) | Baseline network, or the network merged with `?selection_id=` |
| GET | `/api/presets` | — | Named example scenarios |
| GET | `/api/simulation/context?selection_id=` | ✓ | How each dataset maps onto the model, plus map layers and warnings |
| POST | `/api/simulate` | — (needed with `selection_id`) | Run a `Scenario` and return a `SimulationResult`. Runs by signed-in users are stored and get a `run_id`. |
| GET | `/api/simulations`, `/api/simulations/{run_id}` | ✓ | Run history |

### `POST /api/simulate` body

```jsonc
{
  "name": "optional label",
  "duration_days": 14,
  "selection_id": "sel_…",          // optional: simulate on the selected datasets
  "disruptions": [
    { "kind": "edge_closure",     "edge_id": "e4-nkpg-cold-to-lkpg-dc" },
    { "kind": "node_outage",      "node_id": "proc-norrkoping-mill", "capacity_factor": 0.0 },
    { "kind": "energy_outage",    "node_id": "e-linkoping-sub",      "backup_factor": 0.1 },
    { "kind": "production_shock", "factor": 0.6 },
    { "kind": "fuel_shortage",    "factor": 0.35 }
  ]
}
```

`factor`, `capacity_factor` and `backup_factor` are all **remaining fractions**
(0 = gone, 1 = unaffected).

### How datasets feed the model (`app/merge.py`)

Each dataset's `metadata.simulation.role` decides what it feeds, and
`simulation.mapping` maps network fields to its columns. A field with no
mapping uses the column of the same name.

| Role | Becomes | Fields read |
|---|---|---|
| `production` | farm nodes | `id`, `production_tpd`, `name`, `depends_on` |
| `processing` | processing / storage nodes (`type` containing storage, warehouse, cold or dc → storage) | `id`, `capacity_tpd`, `stock_tonnes`, `type`, `depends_on` |
| `logistics` | edges | `id`, `source`, `target`, `capacity_tpd`, `distance_km`, `mode` |
| `energy` | substations | `id`, `name`, `serves` (node ids, separated by `,` or `;`) |
| `population` / `demand` | towns, matched by id, then name / `municipality` | `population` (→ 1.2 kg/person/day), `demand_tpd`, `local_stock_days` |
| `reference` | map layer only | — |

How records are applied:

- A record whose id matches a baseline node or edge **replaces** its values.
- A new node with coordinates is **added** and snapped into the network:
  - new farms connect to the nearest processing site and town;
  - new processing or storage sites connect from the two nearest supply nodes
    and to the two nearest towns;
  - new towns are fed from the two nearest storage or processing sites.
- Roles the selection doesn't cover keep the synthetic baseline.
- Records that can't be used are counted as skipped and reported in
  `warnings`.

## How the model works

1. **Apply disruptions** to a working copy of the network. `energy_outage`
   cascades to every node that lists the substation in `depends_on`.
2. **Daily flow solve.** The region is a capacitated directed graph: farms and
   import gateways inject food, processing and storage have throughput limits,
   towns draw demand. `networkx.min_cost_flow` delivers as much demand as
   physically possible, preferring short hauls and regional production over
   imports. A high-cost relief edge measures whatever is left unmet.
3. **Reserves.** Whatever daily production + transport can't deliver is first
   covered by **regional processing/storage stock** (a throughput-limited pool
   that depletes), then by each town's **local retail + household buffer**
   (`local_stock_days`). When a town's buffer runs out, its people are counted
   as going without.
4. **Per-town impact:** unmet fraction, people affected, buffer days remaining,
   and a severity band (`none` → `critical`).

### Simplifications (it's a planning prototype, not an OR system)

- Regional stock is drawn as one pool allocated proportionally to each town's
  shortfall, rather than routed physically.
- The disruption is constant for the whole run, so the flow solve is steady
  state and only the reserves move day to day.
- Capacities are scaled ×10 and rounded to integers for the solver.

## Data

`app/data/network.json` (and the seeded demo datasets derived from it) is **entirely synthetic** — invented farms, facilities,
capacities, corridors and populations placed on plausible Östergötland
geography. It does not represent real infrastructure. See Section 9 of the
concept document before connecting real data; some of it belongs only behind the
restricted/governed view.
