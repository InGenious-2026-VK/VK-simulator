"""Named example scenarios shown as one-click options in the UI.

Edge / node ids refer to `app/data/network.json`.
"""

from __future__ import annotations

from .models import Disruption, Preset, Scenario

PRESETS: list[Preset] = [
    Preset(
        id="e4-corridor-cut",
        name="E4 corridor cut",
        description=(
            "The Linkoping-Norrkoping corridor is severed (road and rail). "
            "Imports landing at Norrkoping port can no longer reach the western "
            "half of the region."
        ),
        scenario=Scenario(
            name="E4 corridor cut",
            duration_days=14,
            disruptions=[
                Disruption(kind="edge_closure", edge_id="e4-nkpg-cold-to-lkpg-dc"),
                Disruption(kind="edge_closure", edge_id="proc-nkpg-to-lkpg-dc-rail"),
            ],
        ),
    ),
    Preset(
        id="regional-power-outage",
        name="Regional power outage (Linkoping)",
        description=(
            "The Linkoping main substation fails; dependent farms, the dairy, "
            "the packing plant and the distribution centre fall back to ~10% "
            "capacity on backup power."
        ),
        scenario=Scenario(
            name="Regional power outage (Linkoping)",
            duration_days=10,
            disruptions=[
                Disruption(kind="energy_outage", node_id="e-linkoping-sub", backup_factor=0.1),
            ],
        ),
    ),
    Preset(
        id="drought-harvest-loss",
        name="Drought - 50% harvest loss",
        description=(
            "A poor growing season cuts every farm's output in half for the "
            "whole period. Stored stock cushions the towns at first, then runs "
            "down."
        ),
        scenario=Scenario(
            name="Drought - 50% harvest loss",
            duration_days=21,
            disruptions=[Disruption(kind="production_shock", factor=0.5)],
        ),
    ),
    Preset(
        id="winter-fuel-crisis",
        name="Winter fuel crisis",
        description=(
            "Diesel is rationed: road haulage drops to 35% of normal capacity "
            "for three weeks. Rail links are unaffected."
        ),
        scenario=Scenario(
            name="Winter fuel crisis",
            duration_days=21,
            disruptions=[Disruption(kind="fuel_shortage", factor=0.35)],
        ),
    ),
]

PRESETS_BY_ID = {p.id: p for p in PRESETS}
