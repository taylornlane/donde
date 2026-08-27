# Attribution

Every dataset in this app is free to use commercially, but three of them require
credit. This file is the source of truth; the in-app About screen must render the
same list, and `tools/src/build-db.ts` must stay in sync with it.

## Required attribution

**GeoNames** — countries, cities, administrative divisions
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Credit line: *Contains data from GeoNames.org, licensed CC BY 4.0.*

**World Bank Open Data** — international tourist arrivals, used as the cold-start
input to the rarity score.
Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Credit line: *Contains data from The World Bank, licensed CC BY 4.0.*

**OpenStreetMap** — street-level map tiles above zoom 5, served by
[OpenFreeMap](https://openfreemap.org).
Licensed [ODbL](https://opendatacommons.org/licenses/odbl/).
Credit line: *© OpenStreetMap contributors*
MapLibre renders this attribution automatically in the map's ornament bar. Do not
disable it — the ODbL makes it a licence condition, not a courtesy.

## No attribution required

**Natural Earth** — country polygons. Public domain.

**US National Park Service API** — parks and monuments. US federal government work,
public domain. An API key is required to *fetch* the data but not to redistribute it.

## Not data, but worth recording

The wonder lists in `tools/src/wonders.ts` are transcribed facts (the New7Wonders
poll results, the classical seven) rather than a licensed dataset. "New7Wonders" is
a trademark of the New7Wonders Foundation; we use it descriptively to name the list,
which is nominative fair use, but the app must not imply endorsement or affiliation.

## If you add a source

Add it here first, then to the header comment in `tools/src/build-db.ts`, then write
the loader. A dataset that reaches users without a licence entry is the one bug in
this project that cannot be fixed by shipping an update.
