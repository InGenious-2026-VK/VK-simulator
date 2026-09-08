# InGenious-2026-VK — Östergötland Food Supply Chain Resilience Platform

A layered map visualization platform for planning Östergötland's food supply
chain resilience — from everyday regional planning to total-defence/wartime
continuity planning — developed as part of the InGenious 2026 programme
(Linköping University) with Vreta Kluster.

## Structure

- `documentation/` — concept & architecture document, research notes, strategy alignment
- `Implementation/` — the prototype web application (React + Vite + MapLibre GL)
- `backend/` — the Python simulation service (FastAPI + networkx): the
  "scenario & analysis layer" that models supply-chain disruptions and their
  effect on people

## Start here

Read `documentation/ostergotland-food-resilience-platform-concept.md` for the
full concept, data layers, stakeholder value, architecture, and roadmap.

### Run the platform

**Windows, quick start:** double-click **`run.bat`** in the repo root. It
creates the Python venv and installs dependencies on first run, then starts both
servers (each in its own window) and opens the app.

**Manual (any OS) — two parts.** The map viewer talks to the simulation backend
over `/api` (Vite proxies it). Start the backend first:

```
cd backend
python -m venv .venv && .venv\Scripts\activate      # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then, in another terminal, the frontend:

```
cd Implementation
npm install
npm run dev
```

The viewer still runs without the backend — you just lose the scenario
simulator. See `backend/README.md` for the model and API.
