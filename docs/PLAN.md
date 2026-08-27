# dónde — build plan

A travel tracker that fills in a world map as you record where you've been. Free,
offline-first, no subscription, and scored so that going somewhere hard counts for
more than going somewhere popular.

## What already works

The foundation is built and typechecks clean. Concretely:

- **Data pipeline** (`tools/`) — downloads GeoNames, World Bank and Natural Earth
  data and compiles a 9.1 MB `reference.db` with 252 countries, 34,124 cities and
  the wonder lists, plus a 300 KB simplified country polygon file. Reruns from
  cache in seconds.
- **Storage** — two SQLite databases. A read-only bundled catalogue, and a
  `user.db` holding visits, wishlist, badges and settings under Drizzle migrations.
- **Persistence** — every toggle writes to disk before the UI updates. There is no
  save button and no unsaved state to lose.
- **Map** — one MapLibre map, two modes. Countries fills whole countries; Cities
  drops a dot on each place you actually stood in. Fully offline at world zoom;
  OpenStreetMap street detail fades in above zoom 5.
- **Screens** — Map, Add (search across countries/cities/parks/wonders), Stats,
  Badges, and a per-country drill-down listing its cities by population.
- **Rarity** — every city carries a 1–100 percentile score. Paris is 1, Asmara 81,
  N'Djamena 96.

## What is deliberately not built yet

Parks are empty until you supply an NPS API key (below). Everything social —
comparing with friends, leaderboards — is Phase 4 and needs a backend that does not
exist yet. That ordering is intentional: the app has to be worth using alone before
it is worth using with other people.

---

## Architecture, and why

**Expo + React Native, one codebase for iOS and Android.** The alternative is two
native apps, which for a solo project means shipping half as fast for map rendering
that a cross-platform library already does well.

**Two databases, not one.** The catalogue is regenerated whenever the data pipeline
runs; user visits must survive that forever. Keeping them in separate files means
shipping new place data is a file swap, not a migration with a merge step. They are
never joined in SQL — visits are small enough to hold in memory and join in JS.

**Visits live in memory, SQLite is the source of truth.** Writes go to disk first,
then the in-memory set updates. A crash can lose a frame of UI state but never a
recorded visit. This is what lets a map layer ask "is this filled?" 300 times a
frame without touching the database.

**Toggling a visit changes a layer filter, not source data.** Marking Japan does not
re-upload 300 KB of polygons to the renderer — it flips which of two already-loaded
fill layers claims that feature. This is the difference between an instant tap and a
stuttering one.

**The basemap is hand-built and minimal.** An off-the-shelf map style competes with
the choropleth: every road casing is contrast that the visited/unvisited distinction
has to fight through. Roughly a dozen layers keeps the thing you came to look at the
loudest thing on screen — and keeps the world view working with no network.

**No generative AI anywhere.** Not in the app, not in the pipeline.

---

## Rarity, in detail

This is the feature that distinguishes dónde from a country counter, so it is worth
being precise about what it does and does not claim.

The honest measure of rarity is "what fraction of users have been here", which on day
one is unknowable. The cold-start prior blends two signals: city population (log
scale — tourism concentrates super-linearly in big cities) and how touristed the
country is (World Bank international arrivals — Paris and Ouagadougou are comparably
sized capitals; what separates them is 90M arrivals a year versus well under one).

The raw blend is then **ranked into percentiles across the whole catalogue**. This
matters: in absolute terms the scores pile up between 35 and 50 and nothing ever
reaches 80, so every city would read "about 42". Ranked, rarity 90 means "rarer than
90% of the 34,124 cities we know about" — a legible sentence, evenly spread by
construction, which is what lets badge thresholds be set against it directly.

`blendWithObserved()` in `tools/src/rarity.ts` is the seam where real data takes
over. It shrinks toward the prior when the sample is small and hands over smoothly
as evidence accumulates, rather than flipping at an arbitrary threshold. It is
written and tested but unused until Phase 4 gives us users to observe.

**Known limitation:** absolute arrivals over-rewards small countries. Reykjavík
scores 84 despite Iceland being thoroughly touristed, because 2M arrivals is a low
absolute number. Arrivals per capita would fix Iceland and break somewhere else.
Real visit data is the actual fix; this is a prior, not a verdict.

---

## Roadmap

### Phase 1 — Make it usable daily *(next)*

1. **Get an NPS API key** — free, arrives within the hour, from
   [nps.gov/subjects/developer](https://www.nps.gov/subjects/developer/get-started.htm).
   Then `NPS_API_KEY=... npm run build:db` in `tools/` fills the parks table
   (~470 units) and the National Parks counter and its two badges come alive.
2. **Run it on a device.** MapLibre is a native module, so Expo Go will not work —
   this needs a dev build (`npx expo run:ios`). See Running it below.
3. **Tap-to-toggle on the map itself.** The press handler routes to the country
   screen today; long-press to mark visited without leaving the map is the
   interaction people will actually use.
4. **Viewport-driven city browsing.** `citiesInBounds()` and the map's
   `onViewportChange` are both written and wired but nothing consumes them yet.
   This is the "zoom in to remember where you went" feature — showing unvisited
   cities as hollow dots you can tap.
5. **Year and note editing.** The schema and store methods exist; no UI reaches them.

### Phase 2 — Make it feel finished

6. **Badge unlock moments.** `newlyEarned()` exists and nothing calls it. Earning a
   badge should interrupt with something, and persist to the `badges` table so the
   earned-on date survives future rule changes.
7. **Dark mode audit.** The palette has both schemes; the map has never been looked
   at in dark.
8. **Onboarding.** A first run that asks for your home country and three places you
   have been beats an empty map.
9. **Share cards.** A rendered image of your map with the headline number. This is
   the app's entire growth strategy, so it should be genuinely nice.
10. **Home screen widget.** Country count at a glance. `expo-apple-targets` on iOS.

### Phase 3 — Depth

11. **UNESCO World Heritage sites** — ~1,200 entries, the biggest single addition to
    the collection lists. The `landmarks` table already has a `unesco` kind reserved.
12. **Admin1 region shading** as a third map mode — states and provinces rather than
    whole countries. ~4,600 polygons; the pipeline pattern is identical to countries.
13. **Trip grouping** — cluster visits into trips by date so the app can say
    "Japan, 2019" rather than a flat list.
14. **Import** from Been, Visited, or a CSV. The single biggest barrier to switching.

### Phase 4 — Other people

15. **Backend + auth.** Supabase (Postgres, row-level security, generous free tier).
    Sync is last-write-wins per visit row; the local database stays authoritative and
    the app must keep working fully offline.
16. **Observed rarity.** Aggregate visit counts feed `blendWithObserved()` and the
    scores stop being a guess. Aggregate-only, never per-user.
17. **Compare with friends.** Two maps side by side, and the set difference — the
    "places I've been that you haven't" view is the whole point.
18. **Leaderboards** by explorer score rather than raw country count, so they reward
    the kind of travel the app claims to care about.

### Phase 5 — Ship

19. Icon and splash, App Store and Play listings, screenshots.
20. Privacy policy — trivially short, because the app collects nothing until Phase 4.
21. **Android build.** Note there is no Android SDK installed on this machine yet;
    either install Android Studio or use EAS Build's cloud builders.

---

## Running it

```bash
# Reference data (once, or whenever you want fresh data)
cd tools && npm install
NPS_API_KEY=your_key npm run build          # builds reference.db + countries.geojson

# The app — needs a native dev build, not Expo Go, because MapLibre is native
cd .. && npm install
npx expo run:ios                            # or: npx expo run:android
```

`npx tsc --noEmit` typechecks the app; the same command inside `tools/` covers the
pipeline. Both are clean as of this writing.

## Things to know before changing something

- **`assets/data/` is generated.** Never edit `reference.db` or `countries.geojson`
  by hand; change `tools/` and rebuild.
- **Bump `referenceDbVersion` in `app.json`** whenever you regenerate the catalogue,
  or installed apps will keep using the old copy — the version marker is what
  triggers the re-copy on launch.
- **New data source? Update `docs/ATTRIBUTION.md` first.** A dataset that reaches
  users without a licence entry is the one bug you cannot fix by shipping an update.
- **The Vercel plugin in this workspace fires constantly and is always wrong here.**
  It suggests Next.js, `use client`, and AI SDK skills at a React Native project.
  Ignore it.
