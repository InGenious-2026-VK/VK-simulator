"""Build the place master table (app/data/reference/places.csv) from Wikidata.

PLACEHOLDER: the table this writes has not been reviewed by a person yet.
See app/data/reference/README.md for what to check and what is missing.

Writes:
- every current Swedish municipality (kind "municipality"), positioned at its
  seat (centralort);
- every urban area (tätort, kind "town") in the counties listed in
  TOWN_COUNTIES. Only Östergötland for now; add county codes to expand.

Wikidata is CC0 (public domain), so the data can be used without attribution.
Needs an internet connection; uses only the standard library.

Usage (from the backend folder):
    python scripts/build_places.py
"""

import csv
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "vk-simulator-place-table/1.0 (student project)"
OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "reference" / "places.csv"
FIELDS = [
    "kind", "name", "municipality_code", "municipality", "county_code",
    "lat", "lon", "population", "wikidata", "reviewed",
]

TOWN_COUNTIES = ["05"]  # Östergötland

# Municipality codes start with the county code. Wikidata also keeps the codes
# that municipalities in Skåne and Västra Götaland had before those counties
# were merged (1997/1998); requiring the prefix to match drops those.
MUNICIPALITIES = """
SELECT ?muni ?code ?enName ?countyCode ?seat ?seatLabel ?seatCoord WHERE {
  ?muni wdt:P31 wd:Q127448 ; wdt:P525 ?code ; wdt:P131 ?county .
  ?county wdt:P507 ?countyCode .
  FILTER(STRSTARTS(?code, ?countyCode))
  FILTER NOT EXISTS { ?muni wdt:P576 ?dissolved }
  ?muni wdt:P36 ?seat . ?seat wdt:P625 ?seatCoord .
  ?muni rdfs:label ?enName . FILTER(LANG(?enName) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "sv,en". }
}
"""

TOWNS = """
SELECT ?town ?townLabel ?code ?coord (MAX(?pop) AS ?population) WHERE {
  ?town wdt:P31 wd:Q12813115 ; wdt:P131 ?muni ; wdt:P625 ?coord .
  ?muni wdt:P31 wd:Q127448 ; wdt:P525 ?code .
  FILTER(STRSTARTS(?code, "%s"))
  OPTIONAL { ?town wdt:P1082 ?pop }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "sv,en". }
} GROUP BY ?town ?townLabel ?code ?coord
"""


def query(sparql: str) -> list[dict]:
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'query': sparql, 'format': 'json'})}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as res:
        bindings = json.load(res)["results"]["bindings"]
    return [{k: v["value"] for k, v in b.items()} for b in bindings]


def point(wkt: str) -> tuple[float, float]:
    """'Point(15.62 58.41)' -> (lat, lon), rounded to about 10 m."""
    lon, lat = wkt.removeprefix("Point(").removesuffix(")").split()
    return round(float(lat), 4), round(float(lon), 4)


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def short_name(en_label: str) -> str:
    """'Ödeshög Municipality' -> 'Ödeshög'; 'Gotland Region' style labels too."""
    for suffix in (" Municipality", " Region"):
        if en_label.endswith(suffix):
            return en_label[: -len(suffix)]
    return en_label.removeprefix("Region ")


def main() -> None:
    municipalities: dict[str, dict] = {}
    for r in sorted(query(MUNICIPALITIES), key=lambda r: r["code"]):
        name = short_name(r["enName"])
        lat, lon = point(r["seatCoord"])
        row = {
            "kind": "municipality", "name": name, "municipality_code": r["code"],
            "municipality": name, "county_code": r["countyCode"], "lat": lat, "lon": lon,
            "population": "", "wikidata": qid(r["muni"]), "reviewed": "no",
        }
        # A few municipalities list two seats; keep the one named like the municipality.
        if r["code"] not in municipalities or r["seatLabel"] == name:
            municipalities[r["code"]] = row
    if len(municipalities) != 290:
        sys.exit(f"expected 290 municipalities, got {len(municipalities)}; check the query")

    towns = []
    for county in TOWN_COUNTIES:
        for r in query(TOWNS % county):
            if r["code"] not in municipalities:
                continue
            lat, lon = point(r["coord"])
            pop = r.get("population")
            towns.append({
                "kind": "town", "name": r["townLabel"], "municipality_code": r["code"],
                "municipality": municipalities[r["code"]]["name"], "county_code": county,
                "lat": lat, "lon": lon, "population": int(float(pop)) if pop else "",
                "wikidata": qid(r["town"]), "reviewed": "no",
            })
    towns.sort(key=lambda t: (t["municipality_code"], -(t["population"] or 0), t["name"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(municipalities.values())
        writer.writerows(towns)
    print(f"Wrote {len(municipalities)} municipalities and {len(towns)} towns to {OUT}")


if __name__ == "__main__":
    main()
