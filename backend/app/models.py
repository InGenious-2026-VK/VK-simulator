"""Pydantic request/response models for the simulation API.

Kept permissive on purpose: a `Disruption` is one flat model with a `kind`
tag and a handful of optional knobs, rather than a strict discriminated union.
The engine (`simulation.py`) reads only the fields relevant to each `kind`.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

DisruptionKind = Literal[
    "edge_closure",
    "node_outage",
    "energy_outage",
    "production_shock",
    "fuel_shortage",
]


class Disruption(BaseModel):
    kind: DisruptionKind

    # edge_closure
    edge_id: Optional[str] = None
    # node_outage / energy_outage
    node_id: Optional[str] = None

    # Remaining fraction of capacity after the disruption (0 = fully gone,
    # 1 = unaffected). Which field applies depends on `kind`:
    #   edge_closure / node_outage -> capacity_factor
    #   energy_outage              -> backup_factor (applied to every dependent)
    #   production_shock / fuel_shortage -> factor (applied region-wide)
    capacity_factor: float = Field(default=0.0, ge=0.0, le=1.0)
    backup_factor: float = Field(default=0.0, ge=0.0, le=1.0)
    factor: float = Field(default=1.0, ge=0.0, le=1.0)


class Scenario(BaseModel):
    name: Optional[str] = None
    disruptions: list[Disruption] = Field(default_factory=list)
    duration_days: int = Field(default=14, ge=1, le=120)


class Preset(BaseModel):
    id: str
    name: str
    description: str
    scenario: Scenario


# ---- results ---------------------------------------------------------------

Severity = Literal["none", "minor", "moderate", "severe", "critical"]


class NodeImpact(BaseModel):
    id: str
    name: str
    type: str
    coords: list[float]
    population: int = 0
    demand_tpd: float = 0.0
    met_tpd: float = 0.0
    unmet_fraction: float = 0.0
    people_affected: int = 0
    buffer_days_remaining: float = 0.0
    severity: Severity = "none"


class EdgeFlow(BaseModel):
    id: str
    source: str
    target: str
    mode: str
    coords: list[list[float]]
    flow_tpd: float
    capacity_tpd: float
    utilization: float
    saturated: bool
    closed: bool


class TimelinePoint(BaseModel):
    day: int
    unmet_tpd: float  # raw production + transport shortfall that day
    people_affected: int  # people going short AFTER local buffers are drawn down
    buffer_reserve_pct: float  # regional local (retail + household) buffer left, % of day-0


class RegionSummary(BaseModel):
    total_demand_tpd: float
    baseline_met_tpd: float
    scenario_met_tpd: float
    total_unmet_tpd: float
    pct_demand_met: float
    people_affected: int  # people in an area whose supply cannot meet demand
    worst_area: Optional[str] = None
    first_shortfall_day: Optional[int] = None  # first day supply < demand somewhere
    first_buffer_failure_day: Optional[int] = None  # first day a town's buffer runs out


class SimulationResult(BaseModel):
    scenario_name: str
    duration_days: int
    region_summary: RegionSummary
    nodes: list[NodeImpact]
    edges: list[EdgeFlow]
    timeline: list[TimelinePoint]
