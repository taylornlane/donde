# dónde — build plan

A travel tracker that fills in a world map as you record where you've been. Free,
offline-first, no subscription, and scored so that going somewhere hard counts for
more than going somewhere popular.

Running on iOS. Everything below marked *built* works on a device today.

## What's built

**The catalogue** — compiled offline by `tools/`, bundled at 8.7 MB plus 297 KB of
country polygons. Nothing is fetched at runtime except street-level map tiles.

| | |
|---|---|
| Countries | 252 · 195 UN-recognised |
| Cities | 34,124, searchable by FTS5 |
| US parks | 474 NPS units · 63 National Parks · 88 Monuments |
| Wonders | 21 across three lists |

**Two maps.** Countries fills a whole country the moment you've been anywhere in it.
Cities fills only the places you actually stood in. Country names render at low zoom
and hand over to the basemap's own labels at zoom 5.

**The map is an input.** Zoom past 4.5 and every city in view appears as a hollow
ring; past 5.5 they carry names. Tap one to record the visit. This is the "remind
myself what's around" case, and it's the difference between the map being a readout
and being the thing you actually use.

**Visits** save to SQLite before the interface updates — no save button, nothing to
lose. Each carries an optional date at whatever precision you remember: `2019`,
`2019-04`, or a full day.

**Named checklists.** As many as you like. Any place can go on any list, and marking
somewhere visited ticks it on every list at once — there's no separate checked
state, so they can't disagree. Lists never count toward statistics: a list is intent,
the map is record.

**Rarity**, as a percentile across the whole catalogue, surfaced as four bands —
Common, Uncommon, Rare, Remote. "Rarest first" in city search browses the obscure end
directly. Paris is 1, Reykjavík 84, N'Djamena 96.

**Stats** — share of world, land area, and humanity; by continent; by year; a
month histogram of when you travel; your rarity distribution; parks; wonders.

**18 badges** across milestones, geography, rarity and collections.

**Eight map colours**, persisted, recolouring the whole app rather than just the map.

## What's deliberately not built

**No backend, and no social features.** Decided, not deferred by accident. The app
has to be worth using alone first, and everything works offline as a result.

**No "most popular destinations this month".** It needs either other users or a
monthly tourism dataset that does not appear to exist in free, redistributable form —
World Bank arrivals (which the rarity score already uses) is annual only. The honest
version of that comparison is built instead: *"62% of the places you've been are ones
few travellers reach."*

**No location/GPS.** Nothing in a tracker of places you've already been obviously
needs it.

---

## Architecture, and why

**Two databases, never joined in SQL.** The catalogue is regenerated whenever the
pipeline runs; visits must survive that forever. Separate files make shipping new
place data a file swap rather than a migration with a merge step. Visits are small
enough to hold in memory and join in JS.

**Visits live in memory, SQLite is truth.** Writes hit disk first, then memory. A
crash can lose a frame of interface state but never a recorded visit — and a map
layer can ask "is this filled?" hundreds of times a frame for free.

**Toggling a visit changes a layer filter, not source data.** Marking Japan flips
which of two already-loaded fill layers claims that feature, rather than re-uploading
300 KB of polygons.

**The basemap is hand-built and spare.** An off-the-shelf style competes with the
choropleth — every road casing is contrast the visited/unvisited distinction has to
fight through. A dozen layers keeps the point of the app the loudest thing on screen,
and keeps the world view working with no network.

**Never return a fresh array, object or Set from a Zustand selector**, or a fresh
callback to a native map prop. Both compare by reference. This caused three separate
bugs — two infinite render loops and one frozen app. See `CLAUDE.md`.

---

## How it builds

**Local builds do not work, and this is not fixable by clearing caches.** Xcode 16.4
ships Swift 6.1.2; `expo-modules-jsi` requires swift-tools 6.2, which needs Xcode
26.x. SPM reports this as a blank `Could not resolve package dependencies:` with no
reason attached. Updating Xcode is a ~15 GB download that hasn't been taken.

Builds run on EAS instead, from the pushed commit:

```bash
# Catalogue — only when the data changes
cd tools && NPS_API_KEY=... npm run build:db && npm run build:geometry

# App
npx eas-cli@latest build -p ios --profile simulator
npx eas-cli@latest build:run -p ios --latest
npx expo start --dev-client
```

The EAS project is connected to GitHub, so builds can also be triggered and their
logs read through the Expo MCP tools without touching a terminal.

`npx tsc --noEmit` typechecks the app; the same inside `tools/` covers the pipeline.
Both are clean.

---

## Next

### Now

1. **Device build.** One interactive `eas build -p ios --profile development` run
   creates the provisioning profile for `com.taylorlane.donde`. MCP-triggered builds
   are non-interactive and fail at credentials. The Apple membership already exists.
2. **Badge unlock moments.** `newlyEarned()` is written and nothing calls it. Earning
   one should interrupt, and persist to the `badges` table so the earned-on date
   survives future rule changes.
3. **Notes on visits.** `setNote` exists in the store; no interface reaches it.

### Soon

4. **Dark mode audit** — the palette has both schemes; the map has never been looked
   at properly in dark.
5. **Onboarding** — asking for a home country and three places beats an empty map.
6. **Share cards** — a rendered image of your map and headline number.
7. **Home screen widget** — country count at a glance.

### Later

8. **UNESCO World Heritage sites** — ~1,200 entries; the landmarks table already
   reserves the kind.
9. **Region shading** as a third map mode — states and provinces, ~4,600 polygons,
   same pipeline pattern as countries.
10. **Trip grouping** — cluster dated visits so it can say "Japan, 2019".
11. **Import** from Been, Visited, or CSV — the biggest barrier to switching.

### If it ever goes public

12. Backend, sync, comparing with friends, observed rarity replacing the prior.
    `blendWithObserved()` in `tools/src/rarity.ts` is the seam, written and unused.
13. Icon, store listings, privacy policy (trivially short — nothing is collected).
14. **Android** — no SDK on this machine; cloud builds are the only path.

---

## Things that will bite you

- **`assets/data/` is generated.** Change `tools/` and rebuild. It stays committed
  because EAS builds from the repo and a cloud builder can't run the pipeline —
  gitignoring it produces an app that builds and then crashes with no catalogue.
- **Bump `referenceDbVersion` in `app.json` after regenerating,** or installed apps
  keep the old copy. And changing `app.json` needs a Metro restart with `-c`, not a
  reload — `Constants.expoConfig` is baked into the manifest at startup.
- **The NPS `designation` field cannot identify the 63 National Parks.** Redwood,
  Sequoia & Kings Canyon, and American Samoa all need the exceptions table in
  `tools/src/build-db.ts`. Sequoia & Kings Canyon is one unit worth two parks, which
  is why `is_national_park` holds a count rather than a boolean.
- **New data source → `docs/ATTRIBUTION.md` first.** A dataset that reaches users
  without a licence entry is the one bug you can't fix by shipping an update.
- **The Vercel plugin in this workspace fires constantly and is always wrong here.**
  It suggests Next.js, `use client` and AI SDK skills at a React Native app. Ignore it.
