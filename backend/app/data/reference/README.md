# Reference data

> **Status: PLACEHOLDER.** `places.csv` was generated automatically and has
> **not been reviewed by a person**. Every row has `reviewed = no`. It is good
> enough for drawing maps during development, but not yet for anything shown
> to a client. See "To review" and "To expand" below. Tracked in issue #30.

## `places.csv`: where municipalities and towns are

The source workbooks name places (municipality codes, "Kommun" columns) but
have no coordinates. This table gives each place a map position, so ingest
scripts look positions up (`app/viz/places.py`) instead of typing them in.

| Column | Meaning |
|---|---|
| `kind` | `municipality` or `town` (tätort, urban area) |
| `name` | Short name, e.g. `Linköping` (not "Linköpings kommun") |
| `municipality_code` | Official four-digit code (SCB), e.g. `0580` |
| `municipality` | Name of the municipality the place belongs to |
| `county_code` | Two-digit county code; `05` = Östergötland |
| `lat`, `lon` | WGS84 decimal degrees, 4 decimals (about 10 m) |
| `population` | Towns only; the latest figure on Wikidata (the year varies by town) |
| `wikidata` | Wikidata item, e.g. `Q499410` (Linköping Municipality) → https://www.wikidata.org/wiki/Q499410 |
| `reviewed` | `no` until a person has checked the row; then `yes` |

- **Municipalities (290, all of Sweden):** the position is the municipality's
  **seat** (centralort), not the middle of its area. A seat is where a bubble
  for "the municipality" is expected, and it is always on land.
- **Towns (126, Östergötland only):** every tätort Wikidata lists in the county.

**Source:** Wikidata, which is CC0 (public domain): no attribution or licence
terms. `scripts/build_places.py` rebuilds the table. Note that re-running it
overwrites any review marks; copy them over, or stop re-running it once the
review has started.

## To review

- [ ] Municipalities with two seats on Wikidata, where the script picked one:
      Sundbyberg (0183), Vaggeryd (0665).
- [ ] Towns: the tätort list changes with each SCB count. Check against
      SCB's latest tätort list for Östergötland: missing towns, and towns that
      no longer count as tätort.
- [ ] Spot-check positions on a map, at least the 13 Östergötland municipalities
      and their largest towns. Then set `reviewed` to `yes` on the rows checked.
- [ ] Decide whether population belongs here at all (the year differs per town),
      or should come from SCB with a fixed year.

## To expand

- Towns in other counties: add their county codes to `TOWN_COUNTIES` in
  `scripts/build_places.py` and run it.
- Smaller places (småorter), if a dataset needs them.
- Municipality outlines (polygons) for choropleth maps would be a separate file;
  a point per place is all the bubble map needs.
