import io
import json

import pytest

from app.viz import lake
from app.viz.contract import ContractError, validate
from app.viz.transform import wide_years_to_tidy


# --- transformer -----------------------------------------------------------

YEARS = [2019, 2020, 2021, 2022, 2023]
SHEET = [
    (None, "Jordbruksmarkens användning", None, None, None, None, None),
    (None, None, *YEARS),
    ("JO0104B1", "Åkermark", 10, 11, 12, 13, 14),
    ("JO0104B6", "Betesmark", 5, 4, None, 2, 1),
    (None, "Total", 15, 15, 12, 15, 15),
    (None, "Källa: Jordbruksverket", None, None, None, None, None),
    # a second table reusing a label - must be ignored
    (None, *YEARS),
    ("Betesmark", 99, 99, 99, 99, 99),
]
LABELS = {"Åkermark": "Arable land", "Betesmark": "Pasture"}


def test_wide_to_tidy_reshapes_first_table_only():
    rows = wide_years_to_tidy(SHEET, LABELS)
    assert rows[0] == {"date": 2019, "series": "Arable land", "value": 10}
    assert {r["series"] for r in rows} == {"Arable land", "Pasture"}
    assert 99 not in [r["value"] for r in rows]


def test_wide_to_tidy_skips_empty_cells():
    rows = wide_years_to_tidy(SHEET, LABELS)
    pasture_years = [r["date"] for r in rows if r["series"] == "Pasture"]
    assert pasture_years == [2019, 2020, 2022, 2023]


def test_wide_to_tidy_reports_missing_label():
    with pytest.raises(ValueError, match="Forest"):
        wide_years_to_tidy(SHEET, {"Skog": "Forest"})


def test_wide_to_tidy_needs_a_year_header():
    with pytest.raises(ValueError, match="header"):
        wide_years_to_tidy([("Åkermark", 1, 2, 3)], LABELS)


# --- contract ----------------------------------------------------------------

def test_validate_converts_values_to_numbers():
    rows = validate([{"date": "2020", "series": "A", "value": "1.5"}], "line")
    assert rows == [{"date": "2020", "series": "A", "value": 1.5}]


@pytest.mark.parametrize(
    "rows, message",
    [
        ([], "no rows"),
        ([{"date": "2020", "value": "1"}], "missing column"),
        ([{"date": "2020", "series": "A", "value": "n/a"}], "not a number"),
        ([{"date": "2020", "series": "", "value": "1"}], "empty"),
        (
            [
                {"date": "2020", "series": "A", "value": "1"},
                {"date": "2020", "series": "A", "value": "2"},
            ],
            "duplicate",
        ),
    ],
)
def test_validate_rejects_bad_data(rows, message):
    with pytest.raises(ContractError, match=message):
        validate(rows, "line")


def test_validate_accepts_pie_data():
    rows = validate(
        [{"category": "Wheat", "value": "1200"}, {"category": "Barley", "value": "0"}], "pie"
    )
    assert rows == [{"category": "Wheat", "value": 1200.0}, {"category": "Barley", "value": 0.0}]


@pytest.mark.parametrize(
    "rows, message",
    [
        ([{"category": "Wheat"}], "missing column"),
        ([{"category": "Wheat", "value": "lots"}], "not a number"),
        ([{"category": " ", "value": "1"}], "empty"),
        ([{"category": "Wheat", "value": "-5"}], "negative"),
        (
            [{"category": "Wheat", "value": "1"}, {"category": "Wheat", "value": "2"}],
            "duplicate",
        ),
    ],
)
def test_validate_rejects_bad_pie_data(rows, message):
    with pytest.raises(ContractError, match=message):
        validate(rows, "pie")


PLACE = {"name": "Linköping", "lat": "58.41", "lon": "15.62", "value": "1200"}


def test_validate_accepts_bubble_map_data():
    rows = validate([PLACE, {**PLACE, "name": "Norrköping", "value": "0"}], "bubble-map")
    assert rows[0] == {"name": "Linköping", "lat": 58.41, "lon": 15.62, "value": 1200.0}
    assert rows[1]["value"] == 0.0


@pytest.mark.parametrize(
    "rows, message",
    [
        ([{"name": "Linköping", "lat": "58.41", "value": "1"}], "missing column.*lon"),
        ([{**PLACE, "lat": "north"}], "'lat' is not a number"),
        ([{**PLACE, "lat": "158.41"}], "'lat' must be between -90 and 90"),
        ([{**PLACE, "lon": "-181"}], "'lon' must be between -180 and 180"),
        ([{**PLACE, "value": "-1"}], "negative"),
        ([{**PLACE, "name": ""}], "empty"),
        ([PLACE, PLACE], "duplicate"),
    ],
)
def test_validate_rejects_bad_bubble_map_data(rows, message):
    with pytest.raises(ContractError, match=message):
        validate(rows, "bubble-map")


def test_validate_rejects_unknown_chart_type():
    with pytest.raises(ContractError, match="unknown chart type"):
        validate([{"a": "1"}], "radar")


# --- loader + API, against datasets uploaded to the Data Lake ---------------
# `client`, `planner` and `producer` come from conftest.py.


def _upload(client, headers, csv_text, title="Demo", unit=None, name="d.csv", visibility="private"):
    """Upload one CSV the way the Data Lake window does; returns the dataset id."""
    column = {"name": "value", "type": "number", **({"unit": unit} if unit else {})}
    meta = {
        "schema_version": "1.0",
        "title": title,
        "description": "A dataset for the overview tests.",
        "category": "other",
        "source": {"organization": "Test"},
        "license": "CC0-1.0",
        "sensitivity": "open",
        "files": [{"name": name, "format": "csv", "columns": [column]}],
    }
    r = client.post(
        "/api/datasets",
        headers=headers,
        files=[
            ("metadata", ("metadata.json", json.dumps(meta), "application/json")),
            ("files", (name, io.BytesIO(csv_text.encode()), "text/csv")),
        ],
        data={"visibility": visibility},
    )
    assert r.status_code == 202, r.text
    return r.json()["id"]


def _selection(client, headers, ids):
    r = client.post("/api/selections", headers=headers, json={"dataset_ids": ids})
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.parametrize(
    "columns, expected",
    [
        (["date", "series", "value"], "line"),
        (["category", "value"], "pie"),
        (["name", "lat", "lon", "value"], "bubble-map"),
        (["name", "lat", "lon", "value", "category"], "bubble-map"),
        (["date", "series", "value", "category"], "line"),
        (["date", "value"], None),
    ],
)
def test_chart_type_is_detected_from_columns(columns, expected):
    assert lake.detect_type(columns) == expected


def test_overview_routes_need_sign_in(client):
    assert client.get("/api/viz/datasets/nope").status_code == 401


def test_api_returns_dataset(client, planner):
    ds = _upload(client, planner, "date,series,value\n2020,A,1\n2021,A,2\n", unit="ha")
    res = client.get(f"/api/viz/datasets/{ds}", headers=planner)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Demo"
    assert body["type"] == "line"
    assert body["unit"] == "ha"
    assert body["source"] == "Test"
    assert body["rows"][1] == {"date": 2021, "series": "A", "value": 2.0}


def test_api_returns_pie_dataset(client, planner):
    ds = _upload(client, planner, "category,value\nWheat,1200\nBarley,800\n")
    body = client.get(f"/api/viz/datasets/{ds}", headers=planner).json()
    assert body["type"] == "pie"
    assert body["rows"] == [
        {"category": "Wheat", "value": 1200.0},
        {"category": "Barley", "value": 800.0},
    ]


def test_api_returns_bubble_map_dataset(client, planner):
    ds = _upload(client, planner, "name,lat,lon,value\nLinköping,58.41,15.62,1200\n")
    body = client.get(f"/api/viz/datasets/{ds}", headers=planner).json()
    assert body["type"] == "bubble-map"
    assert body["rows"] == [{"name": "Linköping", "lat": 58.41, "lon": 15.62, "value": 1200.0}]


@pytest.mark.parametrize(
    "csv_text, message",
    [
        ("category,value\nWheat,1200\nWheat,800\n", "line 3: duplicate"),
        ("name,lat,lon,value\nLinköping,58.41,1562,1200\n", "line 2: 'lon' must be between"),
        ("date,value\n2020,1\n", "no file has the columns of a chart type"),
    ],
)
def test_api_reports_contract_breach(client, planner, csv_text, message):
    ds = _upload(client, planner, csv_text)
    res = client.get(f"/api/viz/datasets/{ds}", headers=planner)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "not_chartable"
    assert message in res.json()["error"]["message"]


def test_api_unknown_dataset_is_404(client, planner):
    assert client.get("/api/viz/datasets/nope", headers=planner).status_code == 404


def test_api_hides_other_users_private_datasets(client, planner, producer):
    ds = _upload(client, planner, "category,value\nWheat,1\n")
    assert client.get(f"/api/viz/datasets/{ds}", headers=producer).status_code == 404
    assert client.get(f"/api/viz/datasets/{ds}/views", headers=producer).status_code == 404


def test_selection_lists_chartable_datasets_and_skips_the_rest(client, planner):
    pie = _upload(client, planner, "category,value\nWheat,1\n", title="Pie")
    other = _upload(client, planner, "a,b\n1,2\n", title="Not a chart")
    body = client.get(f"/api/viz/selections/{_selection(client, planner, [pie, other])}/datasets",
                      headers=planner).json()
    assert [(d["id"], d["type"], d["title"]) for d in body["datasets"]] == [(pie, "pie", "Pie")]
    assert "rows" not in body["datasets"][0]
    assert [(s["id"], s["reason"]) for s in body["skipped"]] == [(other, "not_chartable")]


def test_selection_of_someone_else_is_still_checked_for_access(client, planner, producer):
    ds = _upload(client, planner, "category,value\nWheat,1\n")
    sel = _selection(client, planner, [ds])
    body = client.get(f"/api/viz/selections/{sel}/datasets", headers=producer).json()
    assert body["datasets"] == []
    assert body["skipped"][0]["reason"] == "access_revoked"


def test_unknown_selection_is_404(client, planner):
    assert client.get("/api/viz/selections/nope/datasets", headers=planner).status_code == 404


# --- views: a dataset cut into cards for the data overview -------------------

def _line_csv(series_count, years=(2020, 2021)):
    lines = ["date,series,value"]
    for s in range(series_count):
        lines += [f"{y},S{s},{s + 1}" for y in years]
    return "\n".join(lines) + "\n"


def _views(client, headers, csv_text, query=""):
    ds = _upload(client, headers, csv_text)
    return client.get(f"/api/viz/datasets/{ds}/views{query}", headers=headers)


def test_views_of_line_dataset_overview_then_one_per_series(client, planner):
    body = _views(client, planner, _line_csv(6)).json()
    assert body["total"] == 7
    assert body["dataset"]["title"] == "Demo"
    first = body["views"][0]
    assert first["title"] == "Top 4 of 6 series"
    assert {r["series"] for r in first["rows"]} == {"S2", "S3", "S4", "S5"}
    assert [v["title"] for v in body["views"][1:]] == ["S0", "S1", "S2", "S3", "S4", "S5"]
    assert [v["index"] for v in body["views"]] == list(range(7))


def test_views_are_paged(client, planner):
    ds = _upload(client, planner, _line_csv(25))
    page = client.get(f"/api/viz/datasets/{ds}/views?offset=10&limit=10", headers=planner).json()
    assert page["total"] == 26
    assert page["offset"] == 10
    assert [v["index"] for v in page["views"]] == list(range(10, 20))
    last = client.get(f"/api/viz/datasets/{ds}/views?offset=20&limit=10", headers=planner).json()
    assert [v["index"] for v in last["views"]] == list(range(20, 26))


def test_views_page_size_is_limited(client, planner):
    assert _views(client, planner, _line_csv(2), "?limit=500").status_code == 422


def test_views_of_pie_dataset_page_through_the_small_categories(client, planner):
    rows = "\n".join(f"C{i},{100 - i}" for i in range(14))
    views = _views(client, planner, f"category,value\n{rows}\n").json()["views"]
    assert [v["title"] for v in views] == [
        "All categories",
        "Categories 6–11 by size",
        "Categories 12–14 by size",
    ]
    assert [r["category"] for r in views[1]["rows"]] == ["C5", "C6", "C7", "C8", "C9", "C10"]


def test_views_of_bubble_map_rank_places(client, planner):
    rows = "\n".join(f"P{i},58.{i + 10},15.{i + 10},{i}" for i in range(13))
    views = _views(client, planner, f"name,lat,lon,value\n{rows}\n").json()["views"]
    assert [v["title"] for v in views] == ["All places", "Places ranked 1–10", "Places ranked 11–13"]
    assert views[1]["rows"][0]["name"] == "P12"


def test_views_of_unknown_dataset_is_404(client, planner):
    assert client.get("/api/viz/datasets/nope/views", headers=planner).status_code == 404


# --- upload folders written by the ingest scripts ----------------------------

def test_export_writes_an_upload_the_data_lake_accepts(client, planner, tmp_path):
    from app.viz.export import write_upload

    rows = [{"category": "Wheat", "value": 3}, {"category": "Barley", "value": 1}]
    meta = {"title": "Crops", "description": "Two crops for the export test.", "category": "production",
            "source": {"organization": "Test"}}
    folder = write_upload(tmp_path, "crops", rows, ["category", "value"], meta, unit="ha")
    metadata = json.loads((folder / "metadata.json").read_text(encoding="utf-8"))
    r = client.post(
        "/api/datasets",
        headers=planner,
        files=[
            ("metadata", ("metadata.json", json.dumps(metadata), "application/json")),
            ("files", ("crops.csv", (folder / "crops.csv").read_bytes(), "text/csv")),
        ],
        data={"visibility": "private"},
    )
    assert r.status_code == 202, r.text
    body = client.get(f"/api/viz/datasets/{r.json()['id']}", headers=planner).json()
    assert (body["type"], body["unit"], len(body["rows"])) == ("pie", "ha", 2)


def test_export_refuses_metadata_the_data_lake_would_reject(tmp_path):
    from app.viz.export import write_upload

    with pytest.raises(ValueError, match="would be rejected"):
        write_upload(tmp_path, "x", [], ["category", "value"], {"title": "X"})


# --- place master table (placeholder, see app/data/reference/README.md) -----

from app.viz import places  # noqa: E402

SWEDEN_LAT = (55.0, 69.1)
SWEDEN_LON = (10.9, 24.2)


def test_place_table_has_every_municipality_once():
    codes = [p["municipality_code"] for p in places.load_places() if p["kind"] == "municipality"]
    assert len(codes) == 290
    assert len(set(codes)) == 290
    assert all(len(c) == 4 and c.isdigit() for c in codes)


def test_place_table_positions_are_in_sweden():
    for p in places.load_places():
        assert SWEDEN_LAT[0] <= p["lat"] <= SWEDEN_LAT[1], p
        assert SWEDEN_LON[0] <= p["lon"] <= SWEDEN_LON[1], p


def test_place_table_towns_belong_to_known_municipalities():
    codes = {p["municipality_code"] for p in places.load_places() if p["kind"] == "municipality"}
    rows = places.load_places()
    assert {p["kind"] for p in rows} == {"municipality", "town"}
    assert all(p["municipality_code"] in codes for p in rows)
    assert all(p["reviewed"] in ("yes", "no") for p in rows)


@pytest.mark.parametrize("key", ["0580", "580", "Linköping", "linköping", "Linköpings kommun"])
def test_municipality_lookup(key):
    p = places.municipality(key)
    assert p["municipality_code"] == "0580"
    assert p["name"] == "Linköping"


def test_municipality_lookup_keeps_names_ending_in_s():
    assert places.municipality("Borås kommun")["name"] == "Borås"


def test_municipality_lookup_unknown():
    with pytest.raises(KeyError):
        places.municipality("Atlantis")


def test_town_lookup():
    kisa = places.town("Kisa")
    assert kisa["municipality"] == "Kinda"
    assert places.town("kisa", municipality_code="0513") == kisa
    with pytest.raises(KeyError):
        places.town("Kisa", municipality_code="0580")
