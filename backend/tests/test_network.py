import networkx as nx

from app.network import load_network


def test_network_loads_and_is_sane():
    net = load_network()
    assert len(net.nodes) >= 15
    assert len(net.edges) >= 20
    assert net.total_demand_tpd > 0


def test_every_capacity_positive():
    net = load_network()
    for e in net.edges:
        assert e.capacity_tpd > 0
    for n in net.of_type("processing", "storage"):
        assert n.capacity_tpd > 0


def test_supply_can_cover_demand_on_paper():
    net = load_network()
    total_supply = sum(n.base_supply for n in net.of_type("farm", "import"))
    assert total_supply >= net.total_demand_tpd


def test_demand_nodes_are_reachable_from_supply():
    net = load_network()
    g = nx.DiGraph()
    for e in net.edges:
        g.add_edge(e.source, e.target)
    supply = {n.id for n in net.of_type("farm", "import")}
    for d in net.of_type("demand"):
        assert any(
            s in g and nx.has_path(g, s, d.id) for s in supply
        ), f"{d.id} unreachable from any supply node"
