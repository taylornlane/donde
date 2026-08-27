# dónde

A travel tracker that fills in a world map as you record where you've been.

Two maps: one that shades whole countries, one that shades only the cities you
actually stood in. Percentages for how much of the world, how much of a country, and
how much of humanity you've covered. National parks and monuments, the seven wonders,
and badges. Every place carries a **rarity score**, so going somewhere hard counts
for more than going somewhere popular.

Free, no subscription, and it works on a plane.

## Quick start

```bash
# 1. Build the place catalogue (~1 min, cached after the first run)
cd tools
npm install
NPS_API_KEY=your_key npm run build     # key is optional; parks are skipped without it

# 2. Run the app — needs a native dev build, MapLibre isn't in Expo Go
cd ..
npm install
npx expo run:ios                       # or: npx expo run:android
```

A free NPS API key takes a minute to request from
[nps.gov/subjects/developer](https://www.nps.gov/subjects/developer/get-started.htm)
and unlocks the ~470 National Park Service units.

## What's inside

| | |
|---|---|
| **Catalogue** | 252 countries · 34,124 cities · 21 wonders · NPS units |
| **Size** | 9.1 MB database + 300 KB of country polygons, all bundled |
| **Offline** | Everything except street-level detail above zoom 5 |
| **Stack** | Expo 57 · React Native 0.86 · MapLibre · SQLite + Drizzle |

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — roadmap, architecture, and why each choice was made
- [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md) — data sources and their licences
- [`CLAUDE.md`](CLAUDE.md) — conventions for working in this repo

## Data

Built from [GeoNames](https://geonames.org) (CC BY 4.0),
[Natural Earth](https://naturalearthdata.com) (public domain),
[World Bank Open Data](https://data.worldbank.org) (CC BY 4.0), and the
[NPS API](https://www.nps.gov/subjects/developer/) (public domain). Map tiles from
[OpenFreeMap](https://openfreemap.org), © OpenStreetMap contributors.
