# Implementation

Prototype web app for the Östergötland Food Supply Chain Resilience Platform
— a GIS analysis **workspace** built with React + Vite + MapLibre GL. The UI
follows the Claude Design handoff in
`../documentation/InGenious-2026 GIS mockups-handoff.zip`: a top app bar, a
three-panel workspace (Layers · Simulation + Map · Results) and a bottom
timeline, with collapsible panels, a focus mode, an A/B compare view and a
"New scenario" wizard.

## Stack

- React 18
- Vite
- MapLibre GL JS — no API key. Basemaps: OpenFreeMap "positron" vector tiles
  (Light), OpenTopoMap raster (Terrain), Esri World Imagery raster (Satellite).
- Fonts: Geist / Geist Mono (Google Fonts), loaded in `index.html`.

## Getting started

```
cd Implementation
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

### Simulation backend

The **Scenario simulator** panel talks to the Python service in `../backend`.
Vite proxies `/api` → `http://127.0.0.1:8000`, so start the backend first:

```
cd ../backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Without it, the map and layers still work; the Results panel shows the baseline
placeholders and a "backend offline" note.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds this app and publishes it to GitHub Pages
on every push to `main`.

One-time setup on GitHub: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

The workflow sets Vite's `base` to `/<repo-name>/` automatically (or `/` for a
`<user>.github.io` repo). The build has no `/api` backend on Pages, so the app
runs in "backend offline" mode. To make the simulator work there, deploy the
FastAPI service in `../backend` somewhere (Render, Fly.io, a container host) and
add a **repository variable** `API_BASE` (Settings → Secrets and variables →
Actions → Variables) pointing at it, e.g. `https://your-api.example.com/api`.
That host must allow CORS from the Pages origin — add it to `allow_origins` in
`backend/app/main.py`.

Local production preview with a subpath:

```
VITE_BASE=/your-repo/ npm run build && npm run preview
```

## What is wired vs. illustrative

The **Disruption / shock** simulation model is wired to the Python engine:
severity → region-wide production shock, duration → run length, and clicking
corridors / facilities on the map adds edge-closure / node-outage disruptions.
A run produces the real KPIs, the supply-vs-demand and people-affected charts,
and the "most affected municipalities" table.

The other six model tabs, the Monte-Carlo / Sankey / radar / uncertainty
charts, the A/B compare figures and the "recent runs" list are **illustrative
sample data** — every such surface is badged `sample` in the UI. They mark
where future backend work plugs in (see `src/data/workspaceMock.js`).

## Structure

- `src/App.jsx` — workspace orchestrator: panel collapse / focus / compare
  state, layer order, and the bridge from the shock controls to `useSimulation`
- `src/components/`
  - `AppBar.jsx` — identity, study area, scenario picker, Run / New scenario
  - `LayersPanel.jsx` — filterable, drag-reorderable grouped layer list
    (order = map draw order, persisted per browser), simulation-overlay
    toggles + opacity, basemap picker
  - `SimulationPanel.jsx` — the 7 model tabs and their parameter grids
  - `MapPanel.jsx` — wraps `MapView` and the on-map UI (tools, status card,
    legend, scale, node inspector popover)
  - `MapView.jsx` — the MapLibre map: basemap + region mask, mounts every
    registered layer plugin, draws the `sim-network` / `sim-impact` overlays
  - `ResultsPanel.jsx` — the idle / running / results / compare states
  - `TimelineBar.jsx` — transport controls + scrubbable track
  - `ScenarioDialog.jsx` — the "New scenario" wizard
  - `charts.jsx` — inline-SVG chart primitives (line, stacked, Sankey, radar,
    histogram, diverging bars, sparkline)
  - `ui.jsx`, `icons.jsx` — small primitives (Badge, Button, Select, Switch)
- `src/api/client.js` — fetch wrappers for the backend (`/api/network`,
  `/api/presets`, `/api/simulate`)
- `src/scenario/`
  - `useSimulation.js` — scenario state + backend calls
  - `simLayers.js` — builds the map overlay GeoJSON from network / result
  - `severity.js` — shared severity palette
- `src/data/`
  - `ostergotland-boundary.json` — region outline (clips the map)
  - `workspaceMock.js` — illustrative parameters / content for the unwired panels
- `src/layers/` — **the layer plugin system** (see `src/layers/README.md`)
  - `defineLayer.js` — the plugin contract
  - `registry.js` — auto-discovers `src/layers/plugins/*.js`
  - `applyLayer.js` — mounts a plugin onto the MapLibre map
  - `plugins/*.js` — one file per map layer
- `public/data/` — larger datasets fetched at runtime by a plugin's `loadData`
  - `population-density.json` — WorldPop 2020 1 km population density
    (© WorldPop, CC BY 4.0), binned to ~1.5 km and clipped to the county

## Layers are plugins

Each map layer (production, processing, logistics, energy, population,
vulnerability, …) is a self-contained module in `src/layers/plugins/`. To add a
layer, drop in a new file — the registry picks it up automatically and nothing
in the app core changes. See `src/layers/README.md` for the contract and a
worked example.

## Important: replacing sample data

Each plugin currently ships with fictional placeholder features so the UI can
be built and demoed safely. Before wiring real data (farm locations, processing
capacity, energy/water infrastructure), review Section 9 (Governance,
Security & Trust) of `../documentation/ostergotland-food-resilience-platform-concept.md`
— some of this data should only ever live behind the restricted/governed
view, not the public prototype.

## Roadmap

See the concept document in `../documentation/` for the full phased roadmap
(Phase 1: open-data pilot → Phase 4: national template).
