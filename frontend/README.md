# FoodChainIQ frontend

The FoodChainIQ web app: four windows connected by React Router (see
`../documentation/foodchainiq-application-windows.md`).

| Route | Window | Code |
|---|---|---|
| `/` | **Home**: project website, sign-in, **To data lake** once signed in | `src/pages/HomePage.jsx` |
| `/datalake` | **Data Lake**: browse, search and filter, select; upload (3-step dialog); details pane with preview, downloads, visibility and removal request; your removal requests; admin queue | `src/pages/DataLakePage.jsx`, `src/pages/datalake/*` |
| `/visualize?selection=…` | **Visualization**: KPIs, coverage map, charts, field profiles, checks, simulation readiness | `src/pages/VisualizationPage.jsx` |
| `/simulate?selection=…` | **Simulation**: the GIS scenario workspace on the merged network, with each dataset as a map layer. Without `selection` it runs on the synthetic baseline. | `src/pages/SimulationPage.jsx` → `src/components/SimulationWorkspace.jsx` |

Windows 2–4 need a signed-in user. Signed-out visitors are sent to Home
with the sign-in form open. Sessions use an in-memory access token plus an
httpOnly refresh cookie (`src/auth/AuthContext.jsx`, `src/api/client.js`).
On a 401 the client refreshes the session silently and retries once.

The simulation workspace follows the Claude Design handoff in
`../documentation/InGenious-2026 GIS mockups-handoff.zip`: a top app bar, a
three-panel workspace (Layers · Simulation + Map · Results) and a bottom
timeline, with collapsible panels, a focus mode, an A/B compare view and a
"New scenario" wizard.

## Stack

- React 18 + React Router 6
- Vite
- MapLibre GL JS — no API key. Basemaps: OpenFreeMap "positron" vector tiles
  (Light), OpenTopoMap raster (Terrain), Esri World Imagery raster (Satellite).
- Fonts: Geist / Geist Mono (Google Fonts), loaded in `index.html`.

## Getting started

```
cd frontend
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

### Backend

Every window except Home's static content needs the backend in `../backend`
(FastAPI + PostgreSQL). Vite proxies `/api` → `http://127.0.0.1:8000`, so start
the backend first (see `../backend/README.md`, or use `../run.sh` /
`../run.bat`). Without the backend, Home still renders, but sign-in fails with
a "Is the backend running?" message.

## Docker

`Dockerfile` has two stages. The first builds the app with Node 22. The second
serves `dist/` with nginx (`deploy/nginx.conf`), which falls back to
`index.html` for the client-side routes and proxies `/api/` to the `backend`
container. It allows uploads up to 2 GB and streams them without buffering.
Build args: `VITE_API_BASE` (default `/api`) and `VITE_SHOW_DEMO_ACCOUNTS`
(default `false`). Run it through the root `docker-compose.yml`.

## Deployment (Cloudflare)

Deployed with **Wrangler static assets** — the built `dist/` is uploaded as a
Worker with no server code. Config: `wrangler.jsonc` (`assets.directory: ./dist`).
SPA deep links are handled by `assets.not_found_handling:
"single-page-application"` (don't add a `_redirects` `/* → /index.html` rule —
Workers Assets rejects it as an infinite loop).

Deploy from your machine:

```
npm run deploy          # = vite build && wrangler deploy
# first time: npx wrangler login
```

Auto-deploy on push (Cloudflare dashboard → **Workers & Pages → your project →
Settings → Build**, connect the Git repo):

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | `22` (also pinned in `.node-version`) |

**The `name` in `wrangler.jsonc` must match your Cloudflare project name** — edit
it if your project isn't called `vk-simulator`.

The static build has no `/api` backend. To make sign-in and windows 2–4
work:

1. Deploy `../backend` with a PostgreSQL database and a persistent volume for
   `STORAGE_DIR`, for example on Render, Fly.io or any container host.
2. Set the build **environment variable** `VITE_API_BASE` = `https://your-api/api`.
3. On the backend, add the frontend origin to `CORS_ORIGINS`. If the API is on
   a different *site*, also set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`
   so the refresh cookie is sent. Serving both from one domain, with `/api`
   routed to the backend, avoids this.

`VITE_SHOW_DEMO_ACCOUNTS=true` lists the seeded demo accounts in the sign-in
dialog of a production build. Dev builds always list them.

Netlify / Vercel work with the same three build settings. Local production
preview: `npm run build && npm run preview`.

## What is wired vs. illustrative

Home, Data Lake and Visualization are fully backed by the API: no sample data.

In the Simulation window, the **Disruption / shock** model runs on the Python
engine:

- severity → a region-wide production shock;
- duration → the run length;
- clicking corridors or facilities on the map adds edge-closure or
  node-outage disruptions.

With a selection, the network includes the selected datasets. A run produces
the real KPIs, the supply-vs-demand and people-affected charts, and the "most
affected municipalities" table. **Recent runs** is the user's stored run
history.

These parts are still **illustrative sample data**, badged `sample` in the UI:

- the other six model tabs;
- the Monte-Carlo, Sankey, radar and uncertainty charts;
- the A/B compare figures.

They mark where future backend work plugs in (see
`src/data/workspaceMock.js`).

## Structure

- `src/main.jsx`: router and auth provider, with the four routes
- `src/auth/AuthContext.jsx`: session state, `RequireAuth`
- `src/api/client.js`: fetch wrappers for every endpoint (auth, datasets,
  selections, visualization, simulation, admin), plus token refresh
- `src/pages/`
  - `HomePage.jsx`, `DataLakePage.jsx`, `VisualizationPage.jsx`, `SimulationPage.jsx`
  - `datalake/UploadDialog.jsx`: files → validate → sharing
  - `datalake/DetailsPane.jsx`: metadata, files, preview, visibility, removal
  - `datalake/RequestsViews.jsx`: your removal requests; the admin queue
  - `categories.js`: category, visibility and format display metadata
  - `pages.css`: styles for windows 1–3
- `src/components/`
  - `SiteHeader.jsx` (brand, nav, user menu), `LoginDialog.jsx`
  - `CoverageMap.jsx`: MapLibre map of datasets' geometry
  - `dataCharts.jsx`: data-driven time series, bar and histogram charts
  - `SimulationWorkspace.jsx`: the Window 4 orchestrator. It handles panel
    collapse, focus and compare state, layer order (built-in layers plus
    selected-dataset layers), and the bridge from the shock controls to
    `useSimulation`.
  - `AppBar.jsx`: brand, Datasets chip (which inputs come from datasets),
    scenario picker, Run / New scenario
  - `LayersPanel.jsx`, `SimulationPanel.jsx`, `MapPanel.jsx`, `MapView.jsx`,
    `ResultsPanel.jsx`, `TimelineBar.jsx`, `ScenarioDialog.jsx`, `charts.jsx`,
    `ui.jsx`, `icons.jsx`: the workspace UI. If the basemap can't be loaded,
    `MapView.jsx` falls back to a plain background.
- `src/lib/escape.js`: HTML escaping for map popups, which show
  user-uploaded values
- `src/scenario/`: `useSimulation.js` (scenario state and backend calls,
  selection-aware), `simLayers.js`, `severity.js`
- `src/data/`: region boundary and illustrative workspace content
- `src/layers/`: **the layer plugin system** (see `src/layers/README.md`).
  Selected datasets are turned into plugins at runtime (`SimulationPage.jsx`).
- `public/data/`: larger datasets fetched at runtime. This includes
  `population-density.json`, the WorldPop 2020 1 km population density
  (© WorldPop, CC BY 4.0), binned to ~1.5 km and clipped to the county.

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
