"""Window 4 — Simulation: network, presets, selection context, runs."""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import merge
from ..access import audit
from ..db import get_db
from ..errors import ApiError, not_found
from ..models import Scenario, SimulationResult
from ..network import Network, load_network
from ..orm import SimulationRun, User, now
from ..presets import PRESETS
from ..scores import record_usage
from ..security import current_user, optional_user
from ..simulation import simulate
from .common import page_params, paginate
from .selections import load_selection, resolve

router = APIRouter(tags=["Simulation"])

DISCLAIMER = (
    "Synthetic baseline data. Facility locations, capacities and populations are "
    "invented for prototyping and do not represent real infrastructure."
)


def serialize_network(net: Network) -> dict:
    return {
        "meta": net.meta,
        "disclaimer": DISCLAIMER,
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
                "source": net.meta.get("sources", {}).get(n.id, "baseline"),
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
                "origin": net.meta.get("sources", {}).get(e.id, "baseline"),
            }
            for e in net.edges
        ],
    }


def _selection_network(db: Session, user: User | None, selection_id: str) -> tuple[Network, dict]:
    if user is None:
        raise ApiError(401, "unauthenticated", "Sign in to use a dataset selection.")
    sel = load_selection(db, user, selection_id)
    ok, gone = resolve(db, user, sel)
    net, ctx = merge.build(db, [{"id": ds.id, "version": v} for ds, v in ok])
    ctx["unavailable"] = gone
    return net, ctx


@router.get("/health")
def health() -> dict:
    net = load_network()
    return {
        "status": "ok",
        "nodes": len(net.nodes),
        "edges": len(net.edges),
        "total_demand_tpd": round(net.total_demand_tpd, 1),
    }


@router.get("/network")
def network(selection_id: Optional[str] = None, user: User | None = Depends(optional_user),
            db: Session = Depends(get_db)) -> dict:
    if not selection_id:
        return serialize_network(load_network())
    net, _ = _selection_network(db, user, selection_id)
    return serialize_network(net)


@router.get("/presets")
def presets() -> list[dict]:
    return [p.model_dump() for p in PRESETS]


@router.get("/simulation/context")
def simulation_context(selection_id: str, user: User = Depends(current_user),
                       db: Session = Depends(get_db)) -> dict:
    net, ctx = _selection_network(db, user, selection_id)
    return {
        "selection_id": selection_id,
        "inputs": ctx["inputs"],
        "map_layers": ctx["map_layers"],
        "warnings": ctx["warnings"],
        "unavailable": ctx["unavailable"],
        "network_size": {"nodes": len(net.nodes), "edges": len(net.edges),
                         "total_demand_tpd": round(net.total_demand_tpd, 1)},
    }


@router.post("/simulate", response_model=SimulationResult)
def run_simulation(scenario: Scenario, user: User | None = Depends(optional_user),
                   db: Session = Depends(get_db)) -> SimulationResult:
    inputs = {"selection_id": None, "datasets": []}
    if scenario.selection_id:
        net, ctx = _selection_network(db, user, scenario.selection_id)
        inputs = {"selection_id": scenario.selection_id, "datasets": ctx["datasets"]}
    else:
        net = load_network()
    result = simulate(scenario, net)
    result.inputs = inputs
    if user is not None:
        run = SimulationRun(user_id=user.id, selection_id=scenario.selection_id,
                            scenario=scenario.model_dump(), inputs=inputs, result={})
        db.add(run)
        db.flush()
        result.run_id = run.id
        run.result = result.model_dump(mode="json")
        record_usage(db, user, run, inputs["datasets"])
        audit(db, user, "simulation.run", run_id=run.id, selection_id=scenario.selection_id)
        db.commit()
    return result


def _run_summary(r: SimulationRun) -> dict:
    rs = (r.result or {}).get("region_summary", {})
    return {
        "run_id": r.id,
        "created_at": r.created_at,
        "scenario": r.scenario,
        "inputs": r.inputs,
        "feedback": r.feedback,
        "summary": {k: rs.get(k) for k in ("pct_demand_met", "people_affected", "worst_area",
                                           "total_unmet_tpd")},
    }


@router.get("/simulations")
def list_runs(paging=Depends(page_params), user: User = Depends(current_user),
              db: Session = Depends(get_db)) -> dict:
    q = select(SimulationRun).where(SimulationRun.user_id == user.id).order_by(
        SimulationRun.created_at.desc())
    return paginate(db, q, paging, _run_summary)


@router.get("/simulations/{run_id}")
def get_run(run_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    r = db.get(SimulationRun, run_id)
    if r is None or (r.user_id != user.id and user.role != "admin"):
        raise not_found("run", run_id)
    return {**_run_summary(r), "result": r.result}


class FeedbackBody(BaseModel):
    rating: Optional[Literal["up", "meh", "down"]] = None


@router.put("/simulations/{run_id}/feedback")
def rate_run(run_id: str, body: FeedbackBody, user: User = Depends(current_user),
             db: Session = Depends(get_db)) -> dict:
    """Rate a run's result. The rating counts toward the feedback score of every
    dataset the run used; `null` removes it. Only the latest rating counts."""
    r = db.get(SimulationRun, run_id)
    if r is None or r.user_id != user.id:
        raise not_found("run", run_id)
    if not (r.inputs or {}).get("datasets"):
        raise ApiError(422, "nothing_to_rate",
                       "This run used only the baseline network, so there are no datasets to rate.")
    r.feedback = body.rating
    r.feedback_at = now() if body.rating else None
    audit(db, user, "simulation.feedback", run_id=r.id, rating=body.rating)
    db.commit()
    return {"run_id": r.id, "feedback": r.feedback, "feedback_at": r.feedback_at}
