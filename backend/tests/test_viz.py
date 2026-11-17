import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.viz import lake
from app.viz.contract import ContractError, validate
from app.viz.transform import wide_years_to_tidy

client = TestClient(app)


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


# --- loader + API, against a temporary lake ---------------------------------

@pytest.fixture
def temp_lake(tmp_path, monkeypatch):
    def write(csv_text, chart_type="line"):
        (tmp_path / "d.csv").write_text(csv_text, encoding="utf-8")
        manifest = [{"id": "d", "type": chart_type, "file": "d.csv", "title": "Demo"}]
        (tmp_path / "datasets.json").write_text(json.dumps(manifest), encoding="utf-8")

    monkeypatch.setenv("VIZ_DATA_DIR", str(tmp_path))
    return write


def test_api_returns_dataset(temp_lake):
    temp_lake("date,series,value\n2020,A,1\n2021,A,2\n")
    res = client.get("/api/viz/datasets/d")
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Demo"
    assert "file" not in body
    assert body["rows"][1] == {"date": "2021", "series": "A", "value": 2.0}


def test_api_returns_pie_dataset(temp_lake):
    temp_lake("category,value\nWheat,1200\nBarley,800\n", chart_type="pie")
    body = client.get("/api/viz/datasets/d").json()
    assert body["type"] == "pie"
    assert body["rows"] == [
        {"category": "Wheat", "value": 1200.0},
        {"category": "Barley", "value": 800.0},
    ]


def test_api_reports_pie_contract_breach(temp_lake):
    temp_lake("category,value\nWheat,1200\nWheat,800\n", chart_type="pie")
    res = client.get("/api/viz/datasets/d")
    assert res.status_code == 500
    assert "line 3: duplicate" in res.json()["detail"]


def test_api_returns_bubble_map_dataset(temp_lake):
    temp_lake("name,lat,lon,value\nLinköping,58.41,15.62,1200\n", chart_type="bubble-map")
    body = client.get("/api/viz/datasets/d").json()
    assert body["type"] == "bubble-map"
    assert body["rows"] == [{"name": "Linköping", "lat": 58.41, "lon": 15.62, "value": 1200.0}]


def test_api_reports_bubble_map_contract_breach(temp_lake):
    temp_lake("name,lat,lon,value\nLinköping,58.41,1562,1200\n", chart_type="bubble-map")
    res = client.get("/api/viz/datasets/d")
    assert res.status_code == 500
    assert "line 2: 'lon' must be between" in res.json()["detail"]


def test_api_lists_datasets(temp_lake):
    temp_lake("date,series,value\n2020,A,1\n")
    assert client.get("/api/viz/datasets").json() == [{"id": "d", "type": "line", "title": "Demo"}]


def test_api_unknown_dataset_is_404(temp_lake):
    temp_lake("date,series,value\n2020,A,1\n")
    assert client.get("/api/viz/datasets/nope").status_code == 404


def test_api_reports_contract_breach(temp_lake):
    temp_lake("date,value\n2020,1\n")
    res = client.get("/api/viz/datasets/d")
    assert res.status_code == 500
    assert "missing column" in res.json()["detail"]


def test_api_reports_missing_file(temp_lake, tmp_path):
    temp_lake("date,series,value\n2020,A,1\n")
    (tmp_path / "d.csv").unlink()
    assert "file not found" in client.get("/api/viz/datasets/d").json()["detail"]


# --- the real lake shipped in the repo ---------------------------------------

def test_every_shipped_dataset_meets_the_contract(monkeypatch):
    monkeypatch.delenv("VIZ_DATA_DIR", raising=False)
    datasets = lake.list_datasets()
    assert datasets
    for meta in datasets:
        assert lake.load_dataset(meta["id"])["rows"]


# --- views: a dataset cut into cards for the data overview -------------------

def _line_csv(series_count, years=(2020, 2021)):
    lines = ["date,series,value"]
    for s in range(series_count):
        lines += [f"{y},S{s},{s + 1}" for y in years]
    return "\n".join(lines) + "\n"


def test_views_of_line_dataset_overview_then_one_per_series(temp_lake):
    temp_lake(_line_csv(6))
    body = client.get("/api/viz/datasets/d/views").json()
    assert body["total"] == 7
    assert body["dataset"]["title"] == "Demo"
    first = body["views"][0]
    assert first["title"] == "Top 4 of 6 series"
    assert {r["series"] for r in first["rows"]} == {"S2", "S3", "S4", "S5"}
    assert [v["title"] for v in body["views"][1:]] == ["S0", "S1", "S2", "S3", "S4", "S5"]
    assert [v["index"] for v in body["views"]] == list(range(7))


def test_views_are_paged(temp_lake):
    temp_lake(_line_csv(25))
    page = client.get("/api/viz/datasets/d/views?offset=10&limit=10").json()
    assert page["total"] == 26
    assert page["offset"] == 10
    assert [v["index"] for v in page["views"]] == list(range(10, 20))
    last = client.get("/api/viz/datasets/d/views?offset=20&limit=10").json()
    assert [v["index"] for v in last["views"]] == list(range(20, 26))


def test_views_page_size_is_limited(temp_lake):
    temp_lake(_line_csv(2))
    assert client.get("/api/viz/datasets/d/views?limit=500").status_code == 422


def test_views_of_pie_dataset_page_through_the_small_categories(temp_lake):
    rows = "\n".join(f"C{i},{100 - i}" for i in range(14))
    temp_lake(f"category,value\n{rows}\n", chart_type="pie")
    views = client.get("/api/viz/datasets/d/views").json()["views"]
    assert [v["title"] for v in views] == [
        "All categories",
        "Categories 6–11 by size",
        "Categories 12–14 by size",
    ]
    assert [r["category"] for r in views[1]["rows"]] == ["C5", "C6", "C7", "C8", "C9", "C10"]


def test_views_of_bubble_map_rank_places(temp_lake):
    rows = "\n".join(f"P{i},58.{i},15.{i},{i}" for i in range(13))
    temp_lake(f"name,lat,lon,value\n{rows}\n", chart_type="bubble-map")
    views = client.get("/api/viz/datasets/d/views").json()["views"]
    assert [v["title"] for v in views] == ["All places", "Places ranked 1–10", "Places ranked 11–13"]
    assert views[1]["rows"][0]["name"] == "P12"


def test_views_of_unknown_dataset_is_404(temp_lake):
    temp_lake(_line_csv(1))
    assert client.get("/api/viz/datasets/nope/views").status_code == 404


def test_every_view_of_every_shipped_dataset_meets_the_contract(monkeypatch):
    from app.viz.views import build_views

    monkeypatch.delenv("VIZ_DATA_DIR", raising=False)
    for meta in lake.list_datasets():
        data = lake.load_dataset(meta["id"])
        views = build_views(data)
        assert views
        for view in views:
            raw = [{k: str(v) for k, v in r.items()} for r in view["rows"]]
            validate(raw, data["type"])


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
