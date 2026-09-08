import pytest

from app.models import Disruption, Scenario
from app.network import load_network
from app.presets import PRESETS
from app.simulation import simulate


@pytest.fixture(scope="module")
def net():
    return load_network()


def test_baseline_meets_almost_all_demand(net):
    res = simulate(Scenario(name="baseline"), net)
    assert res.region_summary.pct_demand_met >= 98.0
    assert res.region_summary.first_shortfall_day is None
    assert res.region_summary.people_affected == 0
    for n in res.nodes:
        if n.type == "demand":
            assert n.severity in ("none", "minor")


@pytest.mark.parametrize("preset", PRESETS, ids=lambda p: p.id)
def test_each_preset_causes_measurable_impact(preset, net):
    res = simulate(preset.scenario, net)
    assert res.region_summary.pct_demand_met < 100.0
    assert res.region_summary.people_affected > 0
    assert res.region_summary.first_shortfall_day is not None
    assert res.region_summary.worst_area
    assert len(res.timeline) == preset.scenario.duration_days
    # buffers deplete, so the last day is at least as bad as the first
    assert res.timeline[-1].people_affected >= res.timeline[0].people_affected
    assert res.timeline[-1].buffer_reserve_pct <= res.timeline[0].buffer_reserve_pct


def test_energy_outage_cascades_to_multiple_facilities(net):
    scenario = Scenario(
        name="power",
        disruptions=[Disruption(kind="energy_outage", node_id="e-linkoping-sub", backup_factor=0.1)],
    )
    res = simulate(scenario, net)
    degraded = [
        n for n in res.nodes
        if n.type in ("farm", "processing", "storage") and n.unmet_fraction > 0.5
    ]
    assert len(degraded) >= 3


def test_edge_closure_marks_edge_closed(net):
    scenario = Scenario(
        name="cut",
        disruptions=[Disruption(kind="edge_closure", edge_id="e4-nkpg-cold-to-lkpg-dc")],
    )
    res = simulate(scenario, net)
    closed = [e for e in res.edges if e.closed]
    assert any(e.id == "e4-nkpg-cold-to-lkpg-dc" for e in closed)


def test_worse_shock_hurts_more(net):
    mild = simulate(Scenario(disruptions=[Disruption(kind="fuel_shortage", factor=0.7)]), net)
    severe = simulate(Scenario(disruptions=[Disruption(kind="fuel_shortage", factor=0.2)]), net)
    assert severe.region_summary.people_affected >= mild.region_summary.people_affected


def test_deterministic(net):
    scenario = PRESETS[0].scenario
    a = simulate(scenario, net)
    b = simulate(scenario, net)
    assert a.model_dump() == b.model_dump()
