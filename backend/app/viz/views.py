"""Views: a dataset cut into small charts that are each readable on their own.

A CSV can hold hundreds of rows, far more than one chart can show. The data
overview therefore shows a dataset as a stack of cards, one view per card.
Every view keeps the dataset's chart type and row shape, so the frontend draws
it with the same component as the whole dataset.

To give a new chart type views, add a function to VIEW_BUILDERS. Without one,
the dataset gets a single view with all its rows.
"""

from __future__ import annotations

from typing import Callable

LINE_SERIES_IN_OVERVIEW = 4  # the line chart has four series colours
PIE_SLICES_PER_PAGE = 6  # the pie chart has six slice colours
PLACES_PER_PAGE = 10


def _view(title: str, rows: list[dict], subtitle: str | None = None) -> dict:
    return {"title": title, "subtitle": subtitle, "rows": rows}


def _ranked(rows: list[dict]) -> list[dict]:
    """Biggest value first; equal values keep their file order."""
    return sorted(rows, key=lambda r: -r["value"])


def _line_views(rows: list[dict]) -> list[dict]:
    """All series together (at most four, the biggest), then one per series."""
    series: list[str] = []
    totals: dict[str, float] = {}
    for r in rows:
        if r["series"] not in totals:
            series.append(r["series"])
            totals[r["series"]] = 0.0
        totals[r["series"]] += r["value"]

    if len(series) == 1:
        return [_view(series[0], rows)]

    views = []
    if len(series) <= LINE_SERIES_IN_OVERVIEW:
        views.append(_view("All series", rows))
    else:
        top = set(sorted(series, key=lambda s: -totals[s])[:LINE_SERIES_IN_OVERVIEW])
        views.append(
            _view(
                f"Top {LINE_SERIES_IN_OVERVIEW} of {len(series)} series",
                [r for r in rows if r["series"] in top],
                "Biggest by total",
            )
        )
    for name in series:
        views.append(_view(name, [r for r in rows if r["series"] == name]))
    return views


def _pie_views(rows: list[dict]) -> list[dict]:
    """The whole pie, then the smaller categories it groups into "Other", six at a time."""
    views = [_view("All categories", rows)]
    if len(rows) <= PIE_SLICES_PER_PAGE:
        return views
    ranked = _ranked(rows)
    # The whole pie shows the five biggest; the pages start with the sixth.
    for start in range(PIE_SLICES_PER_PAGE - 1, len(ranked), PIE_SLICES_PER_PAGE):
        page = ranked[start : start + PIE_SLICES_PER_PAGE]
        views.append(
            _view(
                f"Categories {start + 1}–{start + len(page)} by size",
                page,
                "Shares within this group",
            )
        )
    return views


def _bubble_map_views(rows: list[dict]) -> list[dict]:
    """All places, then the places ranked by value, ten at a time."""
    views = [_view("All places", rows)]
    if len(rows) <= PLACES_PER_PAGE:
        return views
    ranked = _ranked(rows)
    for start in range(0, len(ranked), PLACES_PER_PAGE):
        page = ranked[start : start + PLACES_PER_PAGE]
        views.append(_view(f"Places ranked {start + 1}–{start + len(page)}", page))
    return views


VIEW_BUILDERS: dict[str, Callable[[list[dict]], list[dict]]] = {
    "line": _line_views,
    "pie": _pie_views,
    "bubble-map": _bubble_map_views,
}


def build_views(dataset: dict) -> list[dict]:
    """All views of a loaded dataset (see lake.load_dataset), numbered from 0."""
    builder = VIEW_BUILDERS.get(dataset["type"])
    views = builder(dataset["rows"]) if builder else [_view(dataset["title"], dataset["rows"])]
    return [
        {"index": i, "type": dataset["type"], "unit": dataset.get("unit"), **v}
        for i, v in enumerate(views)
    ]
