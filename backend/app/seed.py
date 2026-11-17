"""First-run seeding: the platform admin, plus (SEED_DEMO=true) demo users,
groups and sample datasets derived from the synthetic baseline network so the
Data Lake → Visualization → Simulation flow can be tried straight away.

All seeded data is SYNTHETIC — see app/data/network.json's disclaimer.
"""

from __future__ import annotations

import csv
import io
import json
import shutil
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .datasets import apply_meta, ingest_version, storage_root, version_dir
from .network import load_network
from .orm import Dataset, DatasetFile, DatasetVersion, Group, GroupMember, User, new_id
from .security import hash_password

DEMO_USERS = [
    ("planner@foodchainiq.local", "Regional Planner", "planner1234"),
    ("producer@foodchainiq.local", "Vreta Producer", "producer1234"),
]
GROUPS = [
    ("Länsstyrelsen Östergötland", "County administrative board — preparedness planning"),
    ("Vreta Kluster producers", "Producers and processors in the Vreta Kluster network"),
]


def _user(db: Session, email: str, name: str, password: str, role: str = "user") -> User:
    u = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if u is None:
        u = User(email=email.lower(), display_name=name, role=role,
                 password_hash=hash_password(password), quota_bytes=settings.default_quota_bytes)
        db.add(u)
        db.flush()
    return u


def _meta(title, description, category, files, role, mapping, sensitivity="open",
          temporal=None, geometry_type="point", keywords=()):
    m = {
        "schema_version": "1.0",
        "title": title,
        "description": description,
        "category": category,
        "keywords": list(keywords) + ["synthetic", "demo"],
        "source": {"organization": "FoodChainIQ demo data (synthetic)",
                   "method": "Derived from the synthetic baseline network"},
        "license": "CC0-1.0",
        "contact": {"name": "FoodChainIQ team"},
        "sensitivity": sensitivity,
        "spatial": {"crs": "EPSG:4326", "region": "Östergötland", "geometry_type": geometry_type},
        "files": files,
        "simulation": {"role": role, "mapping": mapping},
    }
    if temporal:
        m["temporal"] = temporal
    return m


def _fc(features):
    return json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=1)


def _point(props, coords):
    return {"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": coords}}


def _csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def _demo_datasets():
    net = load_network()
    nodes = net.nodes
    farms = [n for n in nodes if n.type == "farm"]
    procs = [n for n in nodes if n.type in {"processing", "storage"}]
    towns = [n for n in nodes if n.type == "demand"]
    energy = [n for n in nodes if n.type == "energy"]
    months = [f"2025-{m:02d}-01" for m in range(1, 13)]
    season = [0.55, 0.55, 0.6, 0.7, 0.85, 1.05, 1.3, 1.55, 1.5, 1.2, 0.8, 0.6]

    yield dict(
        owner="admin", visibility="public", group=None,
        meta=_meta(
            "Processing & storage facilities (synthetic)",
            "Dairies, mills, packing plants and cold/dry storage with daily throughput and "
            "stock. Synthetic demo data matching the baseline network.",
            "processing",
            [{"name": "facilities.geojson", "format": "geojson", "description": "One point per facility.",
              "columns": [
                  {"name": "facility_id", "type": "string", "role": "id"},
                  {"name": "name", "type": "string", "role": "name"},
                  {"name": "type", "type": "string", "role": "category"},
                  {"name": "capacity_tpd", "type": "number", "unit": "t/day", "role": "measure"},
                  {"name": "stock_tonnes", "type": "number", "unit": "tonnes", "role": "measure"},
                  {"name": "depends_on", "type": "string"}]}],
            "processing",
            {"file": "facilities.geojson", "id": "facility_id", "name": "name", "type": "type",
             "capacity_tpd": "capacity_tpd", "stock_tonnes": "stock_tonnes", "depends_on": "depends_on"},
            keywords=["dairy", "mill", "cold chain"]),
        files={"facilities.geojson": _fc([
            _point({"facility_id": n.id, "name": n.name, "type": n.type,
                    "capacity_tpd": n.capacity_tpd, "stock_tonnes": n.stock_tonnes,
                    "depends_on": ",".join(n.depends_on)}, n.coords) for n in procs])},
    )
    yield dict(
        owner="admin", visibility="public", group=None,
        meta=_meta(
            "Town population & food demand (synthetic)",
            "Population and local retail/household buffer for the main towns. Demand is "
            "derived as 1.2 kg/person/day. Synthetic demo data.",
            "population",
            [{"name": "towns.csv", "format": "csv", "columns": [
                {"name": "town_id", "type": "string", "role": "id"},
                {"name": "name", "type": "string", "role": "name"},
                {"name": "lat", "type": "number", "role": "latitude"},
                {"name": "lon", "type": "number", "role": "longitude"},
                {"name": "population", "type": "integer", "unit": "people", "role": "measure"},
                {"name": "local_stock_days", "type": "number", "unit": "days", "role": "measure"}]}],
            "population",
            {"file": "towns.csv", "id": "town_id", "name": "name", "population": "population",
             "local_stock_days": "local_stock_days"},
            keywords=["population", "demand"]),
        files={"towns.csv": _csv([
            {"town_id": n.id, "name": n.name, "lat": n.coords[1], "lon": n.coords[0],
             "population": n.population, "local_stock_days": n.local_stock_days} for n in towns])},
    )
    yield dict(
        owner="producer", visibility="group", group=1,
        meta=_meta(
            "Farm production 2025 — dry summer (synthetic)",
            "Arable and livestock output per farm area for a dry 2025 season (≈10 % below "
            "normal), with a monthly harvest profile. Synthetic demo data.",
            "production",
            [{"name": "farms.geojson", "format": "geojson", "columns": [
                {"name": "farm_id", "type": "string", "role": "id"},
                {"name": "name", "type": "string", "role": "name"},
                {"name": "production_tpd", "type": "number", "unit": "t/day", "role": "measure"},
                {"name": "depends_on", "type": "string"}]},
             {"name": "monthly_output.csv", "format": "csv", "columns": [
                 {"name": "month", "type": "date", "role": "time"},
                 {"name": "farm_id", "type": "string", "role": "id"},
                 {"name": "output_tonnes", "type": "number", "unit": "tonnes", "role": "measure"}]}],
            "production",
            {"file": "farms.geojson", "id": "farm_id", "name": "name",
             "production_tpd": "production_tpd", "depends_on": "depends_on"},
            sensitivity="internal",
            temporal={"start": "2025-01-01", "end": "2025-12-31", "resolution": "month"},
            keywords=["arable", "harvest"]),
        files={
            "farms.geojson": _fc([
                _point({"farm_id": n.id, "name": n.name,
                        "production_tpd": round(n.production_tpd * 0.9, 1),
                        "depends_on": ",".join(n.depends_on)}, n.coords) for n in farms]),
            "monthly_output.csv": _csv([
                {"month": m, "farm_id": n.id,
                 "output_tonnes": round(n.production_tpd * 0.9 * 30 * s, 1)}
                for m, s in zip(months, season) for n in farms]),
        },
    )
    yield dict(
        owner="planner", visibility="group", group=0,
        meta=_meta(
            "Transport corridors (synthetic)",
            "Road and rail links carrying food between farms, processing, storage and towns, "
            "with daily capacity. Synthetic demo data.",
            "logistics",
            [{"name": "corridors.geojson", "format": "geojson", "columns": [
                {"name": "edge_id", "type": "string", "role": "id"},
                {"name": "source", "type": "string"},
                {"name": "target", "type": "string"},
                {"name": "mode", "type": "string", "role": "category"},
                {"name": "capacity_tpd", "type": "number", "unit": "t/day", "role": "measure"},
                {"name": "distance_km", "type": "number", "unit": "km"}]}],
            "logistics",
            {"file": "corridors.geojson", "id": "edge_id", "source": "source", "target": "target",
             "mode": "mode", "capacity_tpd": "capacity_tpd", "distance_km": "distance_km"},
            sensitivity="internal", geometry_type="line", keywords=["road", "rail", "E4"]),
        files={"corridors.geojson": _fc([
            {"type": "Feature",
             "properties": {"edge_id": e.id, "source": e.source, "target": e.target, "mode": e.mode,
                            "capacity_tpd": e.capacity_tpd, "distance_km": e.distance_km},
             "geometry": {"type": "LineString",
                          "coordinates": [net.node(e.source).coords, net.node(e.target).coords]}}
            for e in net.edges])},
    )
    yield dict(
        owner="planner", visibility="private", group=None,
        meta=_meta(
            "Energy substations (synthetic, restricted)",
            "Main substations and the food facilities that depend on them. Restricted: can "
            "never be made public. Synthetic demo data.",
            "energy",
            [{"name": "substations.csv", "format": "csv", "columns": [
                {"name": "substation_id", "type": "string", "role": "id"},
                {"name": "name", "type": "string", "role": "name"},
                {"name": "lat", "type": "number", "role": "latitude"},
                {"name": "lon", "type": "number", "role": "longitude"},
                {"name": "serves", "type": "string"}]}],
            "energy",
            {"file": "substations.csv", "id": "substation_id", "name": "name", "serves": "serves"},
            sensitivity="restricted", keywords=["substation", "power"]),
        files={"substations.csv": _csv([
            {"substation_id": e.id, "name": e.name, "lat": e.coords[1], "lon": e.coords[0],
             "serves": ";".join(n.id for n in nodes if e.id in n.depends_on)} for e in energy])},
    )


def _create_dataset(db: Session, owner: User, visibility: str, group: Group | None,
                    meta: dict, files: dict[str, str]) -> Dataset:
    ds = Dataset(id=new_id("ds"), owner_id=owner.id, version=1, visibility=visibility,
                 group_id=group.id if group else None, status="processing")
    apply_meta(ds, meta)
    db.add(ds)
    vdir = version_dir(ds.id, 1)
    vdir.mkdir(parents=True, exist_ok=True)
    vrow = DatasetVersion(dataset_id=ds.id, version=1, meta=meta)
    fmt = {f["name"]: f["format"] for f in meta["files"]}
    total = 0
    for name, text in files.items():
        path = vdir / name
        path.write_text(text, encoding="utf-8")
        size = path.stat().st_size
        total += size
        vrow.files.append(DatasetFile(name=name, format=fmt[name], size_bytes=size,
                                      storage_path=str(path)))
    ds.versions.append(vrow)
    ds.size_bytes = total
    return ds


def seed(db: Session) -> None:
    admin = _user(db, settings.admin_email, "Platform Admin", settings.admin_password, role="admin")
    if not settings.seed_demo:
        db.commit()
        return
    users = {"admin": admin}
    for (email, name, pw), key in zip(DEMO_USERS, ["planner", "producer"]):
        users[key] = _user(db, email, name, pw)
    groups = []
    for name, desc in GROUPS:
        g = db.scalar(select(Group).where(Group.name == name))
        if g is None:
            g = Group(name=name, description=desc)
            db.add(g)
            db.flush()
        groups.append(g)
    memberships = [(groups[0], users["planner"], "admin"), (groups[1], users["producer"], "admin"),
                   (groups[1], users["planner"], "member")]
    for g, u, role in memberships:
        if not db.scalar(select(GroupMember).where(GroupMember.group_id == g.id,
                                                   GroupMember.user_id == u.id)):
            db.add(GroupMember(group_id=g.id, user_id=u.id, role=role))
    db.commit()

    if db.scalar(select(func.count()).select_from(Dataset)):
        return
    created = []
    for spec in _demo_datasets():
        group = groups[spec["group"]] if spec["group"] is not None else None
        created.append(_create_dataset(db, users[spec["owner"]], spec["visibility"], group,
                                       spec["meta"], spec["files"]))
    db.commit()
    for ds in created:
        ingest_version(ds.id, 1)


def purge_removed(db: Session, retention_days: int = 30) -> None:
    """Delete stored files of datasets removed more than `retention_days` ago."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    for ds in db.scalars(select(Dataset).where(Dataset.removed_at.is_not(None),
                                               Dataset.removed_at < cutoff)):
        shutil.rmtree(storage_root() / ds.id, ignore_errors=True)
