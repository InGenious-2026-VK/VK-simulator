"""FastAPI app for the Ostergotland food-resilience simulation backend.

Routes (all under /api):
  GET  /api/health    liveness
  GET  /api/network   the baseline synthetic supply-chain network (for drawing)
  GET  /api/presets   named example scenarios
  POST /api/simulate  run a scenario, return per-town impact + a day-by-day timeline
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import Scenario, SimulationResult
from .network import load_network
from .presets import PRESETS
from .simulation import simulate

app = FastAPI(
    title="Ostergotland Food Resilience - Simulation API",
    version="0.1.0",
    description="Synthetic supply-chain disruption simulator. Data is not real.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    net = load_network()
    return {
        "status": "ok",
        "nodes": len(net.nodes),
        "edges": len(net.edges),
        "total_demand_tpd": round(net.total_demand_tpd, 1),
    }


@app.get("/api/network")
def network() -> dict:
    net = load_network()
    return {
        "meta": net.meta,
        "disclaimer": (
            "Synthetic data. Facility locations, capacities and populations are "
            "invented for prototyping and do not represent real infrastructure."
        ),
        "nodes": [
            {
                "id": n.id,
                "type": n.type,
                "name": n.name,
                "coords": n.coords,
                "production_tpd": n.production_tpd or None,
                "supply_tpd": n.supply_tpd or None,
                "capacity_tpd": n.capacity_tpd or None,
                "stock_tonnes": n.stock_tonnes or None,
                "population": n.population or None,
                "demand_tpd": n.demand_tpd or None,
                "local_stock_days": n.local_stock_days or None,
                "depends_on": n.depends_on,
            }
            for n in net.nodes
        ],
        "edges": [
            {
                "id": e.id,
                "source": e.source,
                "target": e.target,
                "mode": e.mode,
                "capacity_tpd": e.capacity_tpd,
                "distance_km": e.distance_km,
                "coords": [net.node(e.source).coords, net.node(e.target).coords],
            }
            for e in net.edges
        ],
    }


@app.get("/api/presets")
def presets() -> list[dict]:
    return [p.model_dump() for p in PRESETS]


@app.post("/api/simulate", response_model=SimulationResult)
def run_simulation(scenario: Scenario) -> SimulationResult:
    return simulate(scenario)
