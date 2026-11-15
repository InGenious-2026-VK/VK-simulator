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
