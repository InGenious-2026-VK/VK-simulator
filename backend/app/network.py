"""Load and validate the synthetic supply-chain network.

The on-disk format is `app/data/network.json` (see its `_disclaimer`). This
module turns it into plain dataclasses and fails loudly on any referential
problem so a broken data file never reaches the solver.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "network.json"

# Nodes that inject food into the region.
SUPPLY_TYPES = {"farm", "import"}
# Nodes that hold a physical buffer and can release it under stress.
BUFFER_TYPES = {"processing", "storage"}
FLOW_TYPES = SUPPLY_TYPES | BUFFER_TYPES | {"demand"}


@dataclass
class Node:
    id: str
    type: str
    name: str
    coords: list[float]
    # supply
    production_tpd: float = 0.0
    supply_tpd: float = 0.0
    # buffer / throughput
    capacity_tpd: float = 0.0
    stock_tonnes: float = 0.0
    # demand
    population: int = 0
    demand_tpd: float = 0.0
    local_stock_days: float = 0.0
    # dependencies
    depends_on: list[str] = field(default_factory=list)
    subtype: str | None = None

    @property
    def base_supply(self) -> float:
        return self.production_tpd if self.type == "farm" else self.supply_tpd


@dataclass
class Edge:
    id: str
    source: str
    target: str
    mode: str
    capacity_tpd: float
    distance_km: float


@dataclass
class Network:
    meta: dict
    nodes: list[Node]
    edges: list[Edge]

    def __post_init__(self) -> None:
        self._by_id = {n.id: n for n in self.nodes}
        self._edge_by_id = {e.id: e for e in self.edges}

    def node(self, node_id: str) -> Node:
        return self._by_id[node_id]

    def edge(self, edge_id: str) -> Edge:
        return self._edge_by_id[edge_id]

    def has_node(self, node_id: str) -> bool:
        return node_id in self._by_id

    def has_edge(self, edge_id: str) -> bool:
        return edge_id in self._edge_by_id

    def of_type(self, *types: str) -> list[Node]:
        wanted = set(types)
        return [n for n in self.nodes if n.type in wanted]

    @property
    def total_demand_tpd(self) -> float:
        return sum(n.demand_tpd for n in self.of_type("demand"))


def _validate(net: Network) -> None:
    ids = {n.id for n in net.nodes}
    if len(ids) != len(net.nodes):
        raise ValueError("network.json: duplicate node id")

    energy_ids = {n.id for n in net.nodes if n.type == "energy"}

    for n in net.nodes:
        if n.type not in FLOW_TYPES | {"energy"}:
            raise ValueError(f"network.json: node {n.id!r} has unknown type {n.type!r}")
        for dep in n.depends_on:
            if dep not in energy_ids:
                raise ValueError(
                    f"network.json: node {n.id!r} depends_on {dep!r} which is not an energy node"
                )
        if n.type == "demand" and n.demand_tpd <= 0:
            raise ValueError(f"network.json: demand node {n.id!r} has no demand_tpd")
        if n.type in SUPPLY_TYPES and n.base_supply <= 0:
            raise ValueError(f"network.json: supply node {n.id!r} has no supply")

    edge_ids = set()
    for e in net.edges:
        if e.id in edge_ids:
            raise ValueError(f"network.json: duplicate edge id {e.id!r}")
        edge_ids.add(e.id)
        if e.source not in ids or e.target not in ids:
            raise ValueError(f"network.json: edge {e.id!r} references a missing node")
        if e.capacity_tpd <= 0:
            raise ValueError(f"network.json: edge {e.id!r} has non-positive capacity")

    # Every demand node must have at least one inbound edge, or it can never be fed.
    fed = {e.target for e in net.edges}
    for n in net.of_type("demand"):
        if n.id not in fed:
            raise ValueError(f"network.json: demand node {n.id!r} has no inbound edge")


def _parse(raw: dict) -> Network:
    nodes = [Node(**{k: v for k, v in n.items() if k in Node.__dataclass_fields__}) for n in raw["nodes"]]
    edges = [Edge(**{k: v for k, v in e.items() if k in Edge.__dataclass_fields__}) for e in raw["edges"]]
    net = Network(meta=raw.get("meta", {}), nodes=nodes, edges=edges)
    _validate(net)
    return net


@lru_cache(maxsize=1)
def load_network() -> Network:
    return _parse(json.loads(DATA_PATH.read_text(encoding="utf-8")))
