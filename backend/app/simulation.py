"""The simulation engine.

Model: the region is a capacitated directed graph. Food enters at farms and
import gateways, moves through processing and storage (each throughput-limited),
and must reach demand nodes (towns). Every simulated day we solve a minimum-cost
flow that satisfies as much demand as physically possible; whatever is left
unmet is drawn from local retail/household buffers, then from processing/storage
stock. Buffers deplete over the scenario's duration, so the shortfall a town
feels grows day by day until either supply recovers (it doesn't, within a run)
or the buffer runs dry.

Output is per-town: what fraction of demand is unmet, how many people that is,
how many days of buffer remain, and a severity band.
"""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx

from .models import (
    Disruption,
    EdgeFlow,
    NodeImpact,
    RegionSummary,
    Scenario,
    SimulationResult,
    TimelinePoint,
)
from .network import Network, load_network

SCALE = 10  # tpd -> integer units (networkx network_simplex needs integers)
UNMET_WEIGHT = 1_000_000  # cost of leaving demand unmet — dominates every route
IMPORT_WEIGHT = 10  # mild preference for regional production over imports
RAIL_FACTOR = 0.8  # rail is "cheaper" per km, so preferred where it exists
BUFFER_DAILY_FRACTION = 0.34  # a store can release at most ~1/3 of throughput/day from stock

_SEVERITY_BANDS = [(0.02, "none"), (0.15, "minor"), (0.40, "moderate"), (0.70, "severe")]


def _severity(fraction: float) -> str:
    for threshold, label in _SEVERITY_BANDS:
        if fraction < threshold:
            return label
    return "critical"


# --------------------------------------------------------------------------
# effective state after disruptions
# --------------------------------------------------------------------------


@dataclass
class EffectiveState:
    supply: dict[str, float]  # farm/import id -> tpd available
    node_cap: dict[str, float]  # processing/storage id -> throughput tpd
    edge_cap: dict[str, float]  # edge id -> tpd
    energy_backup: dict[str, float]  # energy id -> remaining fraction (for reporting)


def _apply_disruptions(net: Network, scenario: Scenario) -> EffectiveState:
    supply = {n.id: n.base_supply for n in net.of_type("farm", "import")}
    node_cap = {n.id: n.capacity_tpd for n in net.of_type("processing", "storage")}
    edge_cap = {e.id: e.capacity_tpd for e in net.edges}
    energy_backup: dict[str, float] = {}

    for d in scenario.disruptions:
        if d.kind == "production_shock":
            for nid in supply:
                if net.node(nid).type == "farm":
                    supply[nid] *= d.factor
        elif d.kind == "fuel_shortage":
            for e in net.edges:
                if e.mode == "road":
                    edge_cap[e.id] *= d.factor
        elif d.kind == "edge_closure" and d.edge_id in edge_cap:
            edge_cap[d.edge_id] *= d.capacity_factor
        elif d.kind == "node_outage" and d.node_id:
            if d.node_id in supply:
                supply[d.node_id] *= d.capacity_factor
            if d.node_id in node_cap:
                node_cap[d.node_id] *= d.capacity_factor
        elif d.kind == "energy_outage" and d.node_id:
            energy_backup[d.node_id] = min(
                energy_backup.get(d.node_id, 1.0), d.backup_factor
            )
            for n in net.nodes:
                if d.node_id in n.depends_on:
                    if n.id in supply:
                        supply[n.id] *= d.backup_factor
                    if n.id in node_cap:
                        node_cap[n.id] *= d.backup_factor

    return EffectiveState(supply, node_cap, edge_cap, energy_backup)


# --------------------------------------------------------------------------
# one day's min-cost flow
# --------------------------------------------------------------------------

_BUFFER_TYPES = {"processing", "storage"}


def _in(node_id: str, split: bool) -> str:
    return f"{node_id}#in" if split else node_id


def _out(node_id: str, split: bool) -> str:
    return f"{node_id}#out" if split else node_id


@dataclass
class DaySolution:
    met: dict[str, float]  # demand id -> tpd delivered from production + imports
    edge_flow: dict[str, float]  # edge id -> tpd
    unmet_tpd: float  # region-wide production/transport shortfall


def _solve_day(net: Network, eff: EffectiveState) -> DaySolution:
    """One day's minimum-cost flow using only fresh supply (no stock drawdown).

    Stored stock is handled separately in ``simulate`` as a depleting reserve —
    keeping it out of the LP means ``met`` reflects what the system can deliver
    day-to-day, and the reserve drawdown becomes a visible countdown.
    """
    G = nx.DiGraph()
    total_u = round(net.total_demand_tpd * SCALE)

    G.add_node("SRC", demand=-total_u)
    G.add_node("SNK", demand=total_u)

    def cap(x: float) -> int:
        return max(0, round(x * SCALE))

    for n in net.of_type("farm", "import"):
        avail = cap(eff.supply.get(n.id, 0.0))
        if avail > 0:
            w = IMPORT_WEIGHT if n.type == "import" else 0
            G.add_edge("SRC", n.id, capacity=avail, weight=w)

    # processing / storage: throughput cap modelled as an in->out edge
    split_ids = {n.id for n in net.of_type(*_BUFFER_TYPES)}
    for n in net.of_type(*_BUFFER_TYPES):
        G.add_edge(
            _in(n.id, True), _out(n.id, True),
            capacity=cap(eff.node_cap.get(n.id, 0.0)), weight=1,
        )

    for e in net.edges:
        c = cap(eff.edge_cap.get(e.id, 0.0))
        if c <= 0:
            continue
        w = max(1, round(e.distance_km * (RAIL_FACTOR if e.mode == "rail" else 1.0)))
        G.add_edge(
            _out(e.source, e.source in split_ids),
            _in(e.target, e.target in split_ids),
            capacity=c, weight=w, edge_id=e.id,
        )

    for n in net.of_type("demand"):
        G.add_edge(n.id, "SNK", capacity=cap(n.demand_tpd), weight=0)

    # relief valve — guarantees feasibility; flow here == unmet demand
    G.add_edge("SRC", "SNK", capacity=total_u + SCALE, weight=UNMET_WEIGHT)

    flow = nx.min_cost_flow(G)

    met = {n.id: flow[n.id]["SNK"] / SCALE for n in net.of_type("demand")}
    edge_flow: dict[str, float] = {}
    for u, targets in flow.items():
        for v, f in targets.items():
            eid = G[u][v].get("edge_id")
            if eid is not None:
                edge_flow[eid] = f / SCALE
    unmet = flow["SRC"].get("SNK", 0) / SCALE
    return DaySolution(met, edge_flow, unmet)


# --------------------------------------------------------------------------
# full run: time-step the reserves
# --------------------------------------------------------------------------


def _baseline_met(net: Network) -> float:
    sol = _solve_day(net, _apply_disruptions(net, Scenario()))
    return sum(sol.met.values())


def simulate(scenario: Scenario, net: Network | None = None) -> SimulationResult:
    net = net or load_network()
    eff = _apply_disruptions(net, scenario)
    demand_nodes = net.of_type("demand")

    # Reserves that delay the impact: regional processing/storage stock, drawn
    # as one throughput-limited pool, and each town's local retail+household buffer.
    stock = {n.id: n.stock_tonnes for n in net.of_type(*_BUFFER_TYPES)}
    stock0_total = sum(stock.values()) or 1.0
    local_buf = {n.id: n.local_stock_days * n.demand_tpd for n in demand_nodes}
    local_buf0_total = sum(local_buf.values()) or 1.0

    timeline: list[TimelinePoint] = []
    first_shortfall_day: int | None = None
    first_buffer_failure_day: int | None = None
    last_met: dict[str, float] = {}
    last_shortfall: dict[str, float] = {}
    last_edge_flow: dict[str, float] = {}
    buf_exhausted: set[str] = set()

    # steady-state flow: constant disruption ⇒ the same solve every day
    sol = _solve_day(net, eff)
    last_edge_flow = sol.edge_flow

    for day in range(1, scenario.duration_days + 1):
        shortfall = {
            n.id: max(0.0, n.demand_tpd - sol.met[n.id]) for n in demand_nodes
        }
        last_met = dict(sol.met)
        last_shortfall = dict(shortfall)
        gap = sum(shortfall.values())

        # regional stock releases into the gap, limited by loading throughput
        release_cap = {
            sid: min(stock[sid], eff.node_cap.get(sid, 0.0) * BUFFER_DAILY_FRACTION)
            for sid in stock
        }
        release_total = sum(release_cap.values())
        from_stock = min(gap, release_total)
        if release_total > 1e-9:
            for sid in stock:
                stock[sid] = max(
                    0.0, stock[sid] - from_stock * release_cap[sid] / release_total
                )

        day_people_without = 0
        for n in demand_nodes:
            if not n.demand_tpd or shortfall[n.id] <= 1e-9:
                continue
            after_stock = shortfall[n.id] * (1.0 - from_stock / gap) if gap else 0.0
            draw = min(after_stock, local_buf[n.id])
            local_buf[n.id] -= draw
            eff_unmet = after_stock - draw
            day_people_without += round(n.population * eff_unmet / n.demand_tpd)
            if local_buf[n.id] <= 1e-6:
                buf_exhausted.add(n.id)

        if gap > 1e-6 and first_shortfall_day is None:
            first_shortfall_day = day
        if day_people_without > 0 and first_buffer_failure_day is None:
            first_buffer_failure_day = day
        timeline.append(
            TimelinePoint(
                day=day,
                unmet_tpd=round(gap, 1),
                people_affected=day_people_without,
                buffer_reserve_pct=round(
                    (sum(local_buf.values()) + sum(stock.values()))
                    / (local_buf0_total + stock0_total)
                    * 100,
                    1,
                ),
            )
        )

    nodes = _node_impacts(net, eff, demand_nodes, last_met, last_shortfall, local_buf, buf_exhausted)
    edges = _edge_flows(net, eff, last_edge_flow)

    scenario_met = sum(last_met.values())
    total_demand = net.total_demand_tpd
    people_affected = sum(
        n.people_affected for n in nodes if n.type == "demand"
    )
    worst = max(
        (n for n in nodes if n.type == "demand"),
        key=lambda n: n.people_affected,
        default=None,
    )

    summary = RegionSummary(
        total_demand_tpd=round(total_demand, 1),
        baseline_met_tpd=round(_baseline_met(net), 1),
        scenario_met_tpd=round(scenario_met, 1),
        total_unmet_tpd=round(total_demand - scenario_met, 1),
        pct_demand_met=round(scenario_met / total_demand * 100, 1),
        people_affected=people_affected,
        worst_area=worst.name if worst and worst.people_affected > 0 else None,
        first_shortfall_day=first_shortfall_day,
        first_buffer_failure_day=first_buffer_failure_day,
    )

    return SimulationResult(
        scenario_name=scenario.name or "Custom scenario",
        duration_days=scenario.duration_days,
        region_summary=summary,
        nodes=nodes,
        edges=edges,
        timeline=timeline,
    )


def _node_impacts(
    net, eff, demand_nodes, last_met, last_shortfall, local_buf, buf_exhausted
) -> list[NodeImpact]:
    out: list[NodeImpact] = []

    for n in demand_nodes:
        demand = n.demand_tpd
        raw_frac = last_shortfall.get(n.id, 0.0) / demand if demand else 0.0

        sev = _severity(raw_frac)
        if n.id in buf_exhausted:
            # the town is actually going without now, not just drawing down reserves
            order = ["none", "minor", "moderate", "severe", "critical"]
            sev = order[min(len(order) - 1, max(1, order.index(sev) + 1))]

        out.append(
            NodeImpact(
                id=n.id, name=n.name, type="demand", coords=n.coords,
                population=n.population, demand_tpd=round(demand, 1),
                met_tpd=round(last_met.get(n.id, 0.0), 1),
                unmet_fraction=round(raw_frac, 3),
                people_affected=round(n.population * raw_frac),
                buffer_days_remaining=round(
                    local_buf.get(n.id, 0.0) / demand if demand else 0.0, 1
                ),
                severity=sev,
            )
        )

    # supply / buffer / energy nodes: report capacity lost so the map can show degradation
    for n in net.nodes:
        if n.type == "demand":
            continue
        if n.type in ("farm", "import"):
            base, now = n.base_supply, eff.supply.get(n.id, n.base_supply)
        elif n.type in _BUFFER_TYPES:
            base, now = n.capacity_tpd, eff.node_cap.get(n.id, n.capacity_tpd)
        elif n.type == "energy":
            base, now = 1.0, eff.energy_backup.get(n.id, 1.0)
        else:
            base, now = 1.0, 1.0
        lost = 1.0 - (now / base if base else 1.0)
        out.append(
            NodeImpact(
                id=n.id, name=n.name, type=n.type, coords=n.coords,
                unmet_fraction=round(max(0.0, lost), 3),
                severity=_severity(max(0.0, lost)) if lost > 0.02 else "none",
            )
        )

    return out


def _edge_flows(net, eff, last_edge_flow) -> list[EdgeFlow]:
    out: list[EdgeFlow] = []
    for e in net.edges:
        base = e.capacity_tpd
        now = eff.edge_cap.get(e.id, base)
        f = last_edge_flow.get(e.id, 0.0)
        util = f / now if now > 1e-6 else 0.0
        out.append(
            EdgeFlow(
                id=e.id, source=e.source, target=e.target, mode=e.mode,
                coords=[net.node(e.source).coords, net.node(e.target).coords],
                flow_tpd=round(f, 1),
                capacity_tpd=round(now, 1),
                utilization=round(util, 2),
                saturated=util > 0.98 and f > 0.1,
                closed=now <= max(0.05, 0.02 * base),
            )
        )
    return out
