# Simulation backend

Python service that turns the Östergötland food supply chain into a **disruption
simulator**: describe a shock (a severed corridor, a substation failure, a poor
harvest, a fuel shortage) and get back, town by town and day by day, how much
food demand goes unmet and how many people are affected.

This is the "scenario & analysis layer" from the concept document
(`../documentation/ostergotland-food-resilience-platform-concept.md`, Sections 4,
6 and 8.3).

## Stack

- **FastAPI** + **uvicorn** — HTTP API
- **networkx** — minimum-cost flow solver (`network_simplex`)
- **pydantic** — request/response models
- **pytest** — tests

## Run

```
cd backend
python -m venv .venv
.venv\Scripts\activate           # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The frontend (`../Implementation`) proxies `/api` to `http://localhost:8000`, so
start this **before** `npm run dev`.

## Tests

```
cd backend
pytest -q
```

## API

| Method | Path            | Purpose |
|--------|-----------------|---------|
| GET    | `/api/health`   | Liveness + network size |
| GET    | `/api/network`  | The baseline network (nodes + edges + coords) for drawing |
| GET    | `/api/presets`  | Named example scenarios |
| POST   | `/api/simulate` | Run a `Scenario`, return a `SimulationResult` |

### `POST /api/simulate` body

```jsonc
{
  "name": "optional label",
  "duration_days": 14,
  "disruptions": [
    { "kind": "edge_closure",     "edge_id": "e4-nkpg-cold-to-lkpg-dc" },
    { "kind": "node_outage",      "node_id": "proc-norrkoping-mill", "capacity_factor": 0.0 },
    { "kind": "energy_outage",    "node_id": "e-linkoping-sub",      "backup_factor": 0.1 },
    { "kind": "production_shock", "factor": 0.6 },
    { "kind": "fuel_shortage",    "factor": 0.35 }
  ]
}
```

`factor` / `capacity_factor` / `backup_factor` are all **remaining fractions**
(0 = gone, 1 = unaffected).

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

`app/data/network.json` is **entirely synthetic** — invented farms, facilities,
capacities, corridors and populations placed on plausible Östergötland
geography. It does not represent real infrastructure. See Section 9 of the
concept document before connecting real data; some of it belongs only behind the
restricted/governed view.
