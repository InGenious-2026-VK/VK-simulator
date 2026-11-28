"""Merge a selection's datasets into the simulation network (API doc §9.1).

Each dataset's metadata `simulation.role` says what it feeds; `simulation.mapping`
maps network fields to dataset columns (a missing key means "column with the
same name"). Records whose id matches a baseline node/edge replace it; others
are added and snapped to the nearest compatible nodes so they carry flow.
Roles the selection doesn't cover keep the synthetic baseline.
"""

from __future__ import annotations

import math
import unicodedata
from dataclasses import replace
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from . import ingest
from .errors import ApiError
from .network import Edge, Network, Node, _validate, load_network
from .orm import Dataset

INPUT_ROLES = ["production", "processing", "logistics", "energy", "population"]
ROLE_ORDER = {"energy": 0, "production": 1, "processing": 2, "population": 3, "demand": 3,
              "logistics": 4, "reference": 5}


def _km(a: list[float], b: list[float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return round(2 * 6371 * math.asin(math.sqrt(h)), 1)


def _norm(s: Any) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return "".join(ch for ch in s.lower() if ch.isalnum())


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _list(v: Any) -> list[str]:
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    return [p.strip() for p in str(v).replace(";", ",").split(",") if p.strip()]


class _Builder:
    def __init__(self, base: Network):
        self.meta = dict(base.meta)
        self.nodes: dict[str, Node] = {n.id: replace(n, depends_on=list(n.depends_on)) for n in base.nodes}
        self.edges: dict[str, Edge] = {e.id: replace(e) for e in base.edges}
        self.sources: dict[str, str] = {}
        self.kg = float(base.meta.get("kg_per_person_day", 1.2))

    def of_type(self, *types: str) -> list[Node]:
        return [n for n in self.nodes.values() if n.type in types]

    def nearest(self, coords: list[float], types: tuple[str, ...], k: int = 1,
                exclude: str | None = None) -> list[Node]:
        cands = [n for n in self.of_type(*types) if n.id != exclude]
        return sorted(cands, key=lambda n: _km(coords, n.coords))[:k]

    def add_edge(self, src: Node, dst: Node, cap: float, ds_id: str) -> None:
        eid = f"{ds_id}:{src.id}->{dst.id}"
        if eid in self.edges or cap <= 0:
            return
        self.edges[eid] = Edge(id=eid, source=src.id, target=dst.id, mode="road",
                               capacity_tpd=round(cap, 2), distance_km=max(_km(src.coords, dst.coords), 1))
        self.sources[eid] = ds_id

    def network(self) -> Network:
        meta = {**self.meta, "sources": self.sources}
        return Network(meta=meta, nodes=list(self.nodes.values()), edges=list(self.edges.values()))


def _records(ds: Dataset, version: int, mapping: dict) -> list[tuple[dict, list[float] | None]]:
    vrow = ds.version_row(version)
    if vrow is None:
        return []
    file_meta = {f["name"]: f for f in vrow.meta.get("files", [])}
    files = vrow.files
    if mapping.get("file"):
        files = [f for f in files if f.name == mapping["file"]]
    for f in files:
        table = ingest.read_table(Path(f.storage_path), f.format, file_meta.get(f.name))
        if table is None:
            continue
        geoms = table.geometries or [None] * len(table.rows)
        return [(r, ingest.representative_point(g)) for r, g in zip(table.rows, geoms)]
    return []


def _get(row: dict, mapping: dict, key: str) -> Any:
    col = mapping.get(key, key)
    return row.get(col)


def _apply(b: _Builder, ds: Dataset, version: int, role: str, mapping: dict) -> dict:
    stats = {"source": "dataset", "dataset_id": ds.id, "version": version, "title": ds.title,
             "nodes_added": 0, "nodes_replaced": 0, "edges_added": 0, "edges_replaced": 0,
             "records_skipped": 0}
    rows = _records(ds, version, mapping)
    energy_ids = {n.id for n in b.of_type("energy")}

    for i, (row, pt) in enumerate(rows):
        rid = _get(row, mapping, "id")
        rid = str(rid) if rid not in (None, "") else f"{ds.id}-{i + 1}"
        name = _get(row, mapping, "name")
        name = str(name) if name not in (None, "") else rid

        if role == "energy":
            existing = b.nodes.get(rid)
            if existing and existing.type == "energy":
                stats["nodes_replaced"] += 1
            elif pt:
                b.nodes[rid] = Node(id=rid, type="energy", name=name, coords=pt, subtype="substation")
                b.sources[rid] = ds.id
                stats["nodes_added"] += 1
            else:
                stats["records_skipped"] += 1
                continue
            energy_ids.add(rid)
            for served in _list(_get(row, mapping, "serves")):
                if served in b.nodes and rid not in b.nodes[served].depends_on:
                    b.nodes[served].depends_on.append(rid)

        elif role == "production":
            prod = _num(_get(row, mapping, "production_tpd"))
            if not prod or prod <= 0:
                stats["records_skipped"] += 1
                continue
            deps = [d for d in _list(_get(row, mapping, "depends_on")) if d in energy_ids]
            existing = b.nodes.get(rid)
            if existing and existing.type == "farm":
                existing.production_tpd = prod
                existing.name = name if _get(row, mapping, "name") else existing.name
                existing.coords = pt or existing.coords
                existing.depends_on = deps or existing.depends_on
                stats["nodes_replaced"] += 1
            elif pt:
                node = Node(id=rid, type="farm", name=name, coords=pt, production_tpd=prod, depends_on=deps)
                b.nodes[rid] = node
                b.sources[rid] = ds.id
                for dst in b.nearest(pt, ("processing",), 1) + b.nearest(pt, ("demand",), 1):
                    b.add_edge(node, dst, prod * 1.2, ds.id)
                stats["nodes_added"] += 1
            else:
                stats["records_skipped"] += 1
                continue
            b.sources[rid] = ds.id

        elif role == "processing":
            cap = _num(_get(row, mapping, "capacity_tpd"))
            if not cap or cap <= 0:
                stats["records_skipped"] += 1
                continue
            stock = _num(_get(row, mapping, "stock_tonnes")) or 0.0
            typ = str(_get(row, mapping, "type") or "").lower()
            ntype = "storage" if any(w in typ for w in ("storage", "warehouse", "cold", "dc")) else "processing"
            deps = [d for d in _list(_get(row, mapping, "depends_on")) if d in energy_ids]
            existing = b.nodes.get(rid)
            if existing and existing.type in {"processing", "storage"}:
                existing.capacity_tpd = cap
                existing.stock_tonnes = stock or existing.stock_tonnes
                existing.coords = pt or existing.coords
                if _get(row, mapping, "name"):
                    existing.name = name
                existing.depends_on = deps or existing.depends_on
                stats["nodes_replaced"] += 1
            elif pt:
                if not deps:
                    deps = [n.id for n in b.nearest(pt, ("energy",), 1)]
                node = Node(id=rid, type=ntype, name=name, coords=pt, capacity_tpd=cap,
                            stock_tonnes=stock, depends_on=deps)
                b.nodes[rid] = node
                for src in b.nearest(pt, ("farm", "import"), 2, exclude=rid):
                    b.add_edge(src, node, cap, ds.id)
                for dst in b.nearest(pt, ("demand",), 2):
                    b.add_edge(node, dst, cap, ds.id)
                stats["nodes_added"] += 1
            else:
                stats["records_skipped"] += 1
                continue
            b.sources[rid] = ds.id

        elif role in {"population", "demand"}:
            pop = _num(_get(row, mapping, "population"))
            demand = _num(_get(row, mapping, "demand_tpd"))
            if demand is None and pop is not None:
                demand = pop * b.kg / 1000
            if not demand or demand <= 0:
                stats["records_skipped"] += 1
                continue
            stock_days = _num(_get(row, mapping, "local_stock_days"))
            target = b.nodes.get(rid) if rid in b.nodes and b.nodes[rid].type == "demand" else None
            if target is None:
                by_name = {_norm(n.name): n for n in b.of_type("demand")}
                for key in (_get(row, mapping, "municipality"), _get(row, mapping, "name"), rid):
                    if key and _norm(key) in by_name:
                        target = by_name[_norm(key)]
                        break
                if target is None:
                    for n in b.of_type("demand"):  # "Linkoping" matches "Linkoping urban area"
                        if _norm(name) and _norm(n.name).startswith(_norm(name)):
                            target = n
                            break
            if target is not None:
                target.demand_tpd = round(demand, 3)
                target.population = int(pop) if pop is not None else target.population
                if stock_days is not None:
                    target.local_stock_days = stock_days
                b.sources[target.id] = ds.id
                stats["nodes_replaced"] += 1
            elif pt:
                node = Node(id=rid, type="demand", name=name, coords=pt, population=int(pop or 0),
                            demand_tpd=round(demand, 3), local_stock_days=stock_days or 3.0)
                b.nodes[rid] = node
                b.sources[rid] = ds.id
                for src in b.nearest(pt, ("storage", "processing"), 2):
                    b.add_edge(src, node, demand * 2, ds.id)
                stats["nodes_added"] += 1
            else:
                stats["records_skipped"] += 1

        elif role == "logistics":
            cap = _num(_get(row, mapping, "capacity_tpd"))
            src, dst = _get(row, mapping, "source"), _get(row, mapping, "target")
            existing = b.edges.get(rid)
            if existing and cap and cap > 0:
                existing.capacity_tpd = cap
                existing.mode = str(_get(row, mapping, "mode") or existing.mode)
                dist = _num(_get(row, mapping, "distance_km"))
                existing.distance_km = dist or existing.distance_km
                b.sources[rid] = ds.id
                stats["edges_replaced"] += 1
                continue
            if not cap or cap <= 0 or str(src) not in b.nodes or str(dst) not in b.nodes:
                stats["records_skipped"] += 1
                continue
            s, t = b.nodes[str(src)], b.nodes[str(dst)]
            dist = _num(_get(row, mapping, "distance_km")) or max(_km(s.coords, t.coords), 1)
            b.edges[rid] = Edge(id=rid, source=s.id, target=t.id,
                                mode=str(_get(row, mapping, "mode") or "road"),
                                capacity_tpd=cap, distance_km=dist)
            b.sources[rid] = ds.id
            stats["edges_added"] += 1
    return stats


def build(db: Session, items: list[dict]) -> tuple[Network, dict]:
    """Returns (merged network, context) for selection items [{id, version}]."""
    base = load_network()
    b = _Builder(base)
    inputs: dict[str, dict] = {r: {"source": "baseline"} for r in INPUT_ROLES}
    map_layers, warnings = [], []
    used: list[dict] = []

    resolved = []
    for item in items:
        ds = db.get(Dataset, item["id"])
        if ds is None or ds.removed_at is not None:
            continue
        vrow = ds.version_row(item["version"])
        if vrow is None:
            continue
        sim = vrow.meta.get("simulation") or {}
        role = sim.get("role", "reference")
        resolved.append((ROLE_ORDER.get(role, 9), ds, item["version"], role, sim.get("mapping") or {}, vrow))

    for _, ds, version, role, mapping, vrow in sorted(resolved, key=lambda r: r[0]):
        used.append({"id": ds.id, "version": version, "role": role})
        if (vrow.summary or {}).get("has_geometry"):
            map_layers.append({"dataset_id": ds.id, "title": ds.title, "role": role,
                               "category": ds.category,
                               "geometry_url": f"/api/datasets/{ds.id}/geometry"})
        if role == "reference":
            continue
        key = "population" if role == "demand" else role
        try:
            stats = _apply(b, ds, version, role, mapping)
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"{ds.title}: could not be read for simulation ({exc}).")
            continue
        if stats["records_skipped"]:
            warnings.append(f"{ds.title}: {stats['records_skipped']} record(s) skipped "
                            f"(missing id/coordinates/values or unknown node references).")
        if inputs[key].get("source") == "dataset":
            warnings.append(f"Several datasets provide '{key}'; all were applied in order.")
            prev = inputs[key]
            prev.setdefault("also", []).append({"dataset_id": ds.id, "version": version})
            for k in ("nodes_added", "nodes_replaced", "edges_added", "edges_replaced"):
                prev[k] += stats[k]
        else:
            inputs[key] = stats

    net = b.network()
    try:
        _validate(net)
    except ValueError as exc:
        raise ApiError(422, "network_invalid",
                       f"The selected datasets produce an invalid network: {exc}") from exc
    return net, {"inputs": inputs, "map_layers": map_layers, "warnings": warnings, "datasets": used}
