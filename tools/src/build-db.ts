import Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { fetchCached, fetchJson, fetchZippedText, parseTsv } from './download.ts';
import {
  arrivalBounds,
  cityRarityRaw,
  parseArrivals,
  percentileScale,
  TOURIST_ARRIVALS_URL,
} from './rarity.ts';
import { isSovereign } from './un-members.ts';
import { WONDERS } from './wonders.ts';

/**
 * Builds assets/data/reference.db — the read-only catalogue the app ships with.
 *
 * Run with `npm run build:db` from tools/. Set NPS_API_KEY (free, from
 * https://www.nps.gov/subjects/developer/get-started.htm) to include US parks;
 * without it the parks table is built empty and everything else still works, so a
 * missing key never blocks a rebuild.
 *
 * Sources and their licences — all attribution-compatible, all reproduced in
 * docs/ATTRIBUTION.md, which must stay in sync with this list:
 *   GeoNames    CC BY 4.0          cities, countries, admin divisions
 *   World Bank  CC BY 4.0          international tourist arrivals (rarity prior)
 *   NPS API     US public domain   national parks and monuments
 */

const GEONAMES = 'https://download.geonames.org/export/dump';

/**
 * cities15000 is ~25k places — every city over 15,000 people plus every capital.
 * That is the right default: cities5000 (~50k) doubles the bundle for a long tail
 * of towns nobody needs to search, but it is a one-word change when we want it.
 */
const CITY_DATASET = process.env.CITY_DATASET ?? 'cities15000';

const OUT_DIR = join(import.meta.dirname, '..', '..', 'assets', 'data');
const OUT_PATH = join(OUT_DIR, 'reference.db');

const CONTINENTS: Record<string, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
  AN: 'Antarctica',
};

/** Regional-indicator pairs render as a flag, so no flag dataset is needed. */
function flagEmoji(alpha2: string): string {
  return String.fromCodePoint(
    ...[...alpha2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

async function main() {
  console.log(`Building reference.db (${CITY_DATASET})`);

  mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(OUT_PATH)) rmSync(OUT_PATH);

  const db = new Database(OUT_PATH);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  createSchema(db);

  const countries = await loadCountries(db);
  await loadCities(db, countries);
  await loadParks(db);
  loadLandmarks(db);

  console.log('· indexing');
  db.exec(`
    INSERT INTO cities_fts(rowid, name, ascii_name, alt)
      SELECT rowid, name, ascii_name, alt FROM cities;
    INSERT INTO cities_fts(cities_fts) VALUES('optimize');
  `);

  // Denormalise the per-country city count now so the stats screen never has to
  // COUNT(*) across 25k rows while the user is scrolling.
  db.exec(`
    UPDATE countries
       SET city_count = (SELECT COUNT(*) FROM cities WHERE cities.country_id = countries.id);
  `);

  /*
   * Deliberately no build timestamp.
   *
   * The output is committed to git so that EAS cloud builds (which only upload
   * tracked files) have the catalogue. Stamping the clock in here would make every
   * rebuild produce a different 8.9MB blob even when the underlying data is
   * identical, and each one would be stored in history forever. Keeping the file a
   * pure function of its inputs means a no-op rebuild is a no-op commit too.
   *
   * When the catalogue was built is a question git already answers.
   */
  const meta = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?)');
  meta.run('schema_version', '1');
  meta.run('city_dataset', CITY_DATASET);

  db.exec('VACUUM;');
  db.close();

  summarise();
}

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE countries (
      id           TEXT PRIMARY KEY,   -- ISO 3166-1 alpha-2
      iso3         TEXT NOT NULL,
      name         TEXT NOT NULL,
      continent    TEXT NOT NULL,
      region       TEXT,
      capital      TEXT,
      population   INTEGER NOT NULL DEFAULT 0,
      area_km2     REAL    NOT NULL DEFAULT 0,
      lat          REAL    NOT NULL DEFAULT 0,
      lng          REAL    NOT NULL DEFAULT 0,
      un_member    INTEGER NOT NULL DEFAULT 0,
      emoji        TEXT    NOT NULL DEFAULT '',
      city_count   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE cities (
      id           TEXT PRIMARY KEY,   -- GeoNames id
      name         TEXT NOT NULL,
      ascii_name   TEXT NOT NULL,
      alt          TEXT NOT NULL DEFAULT '',
      country_id   TEXT NOT NULL,
      admin1_code  TEXT,
      admin1_name  TEXT,
      population   INTEGER NOT NULL DEFAULT 0,
      lat          REAL NOT NULL,
      lng          REAL NOT NULL,
      timezone     TEXT,
      rarity       INTEGER NOT NULL DEFAULT 50
    );
    CREATE INDEX cities_country_idx ON cities(country_id, population DESC);
    -- Viewport queries filter on both axes; SQLite will only use one, so lead with
    -- latitude, which is the more selective of the two for typical map bounds.
    CREATE INDEX cities_bbox_idx    ON cities(lat, lng);

    CREATE VIRTUAL TABLE cities_fts USING fts5(
      name, ascii_name, alt,
      content='cities', content_rowid='rowid',
      tokenize="unicode61 remove_diacritics 2"
    );

    CREATE TABLE parks (
      id               TEXT PRIMARY KEY,   -- NPS parkCode
      name             TEXT NOT NULL,
      full_name        TEXT NOT NULL,
      designation      TEXT NOT NULL DEFAULT '',
      states           TEXT NOT NULL DEFAULT '',
      lat              REAL NOT NULL DEFAULT 0,
      lng              REAL NOT NULL DEFAULT 0,
      is_national_park INTEGER NOT NULL DEFAULT 0,
      is_monument      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE landmarks (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      kind       TEXT NOT NULL,   -- wonder_new | wonder_ancient | wonder_nature | unesco
      country_id TEXT NOT NULL,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      extant     INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
}

type CountryRow = { id: string; iso3: string; name: string };

async function loadCountries(db: Database.Database): Promise<Map<string, CountryRow>> {
  console.log('· countries');

  const rows = parseTsv(await fetchCached(`${GEONAMES}/countryInfo.txt`).then(String));

  const insert = db.prepare(`
    INSERT INTO countries (id, iso3, name, continent, region, capital, population, area_km2, lat, lng, un_member, emoji)
    VALUES (@id, @iso3, @name, @continent, @region, @capital, @population, @area_km2, @lat, @lng, @un_member, @emoji)
  `);

  const out = new Map<string, CountryRow>();

  db.transaction(() => {
    for (const cols of rows) {
      const [iso, iso3, , , name, capital, area, population, continent] = cols;
      if (!iso || !name || iso.length !== 2) continue;

      insert.run({
        id: iso,
        iso3: iso3 ?? '',
        name,
        continent: CONTINENTS[continent ?? ''] ?? 'Unknown',
        region: null,
        capital: capital || null,
        population: Number(population) || 0,
        area_km2: Number(area) || 0,
        // Filled in below from the country's largest city — countryInfo has no centroid.
        lat: 0,
        lng: 0,
        un_member: isSovereign(iso) ? 1 : 0,
        emoji: flagEmoji(iso),
      });
      out.set(iso, { id: iso, iso3: iso3 ?? '', name });
    }
  })();

  console.log(`  ${out.size} countries`);
  return out;
}

async function loadCities(db: Database.Database, countries: Map<string, CountryRow>) {
  console.log('· cities');

  const admin1 = new Map<string, string>();
  for (const cols of parseTsv(await fetchCached(`${GEONAMES}/admin1CodesASCII.txt`).then(String))) {
    if (cols[0] && cols[1]) admin1.set(cols[0], cols[1]);
  }

  const arrivals = parseArrivals(await fetchJson<unknown>(TOURIST_ARRIVALS_URL));
  const bounds = arrivalBounds(arrivals);
  console.log(`  arrivals data for ${arrivals.size} countries`);

  const text = await fetchZippedText(`${GEONAMES}/${CITY_DATASET}.zip`, `${CITY_DATASET}.txt`);

  const insert = db.prepare(`
    INSERT INTO cities (id, name, ascii_name, alt, country_id, admin1_code, admin1_name, population, lat, lng, timezone, rarity)
    VALUES (@id, @name, @ascii_name, @alt, @country_id, @admin1_code, @admin1_name, @population, @lat, @lng, @timezone, @rarity)
  `);

  // Two passes, because rarity is a rank rather than an absolute: we cannot score
  // the first city until we have seen the last one. 34k rows is nothing to hold.
  const staged: { row: Record<string, unknown>; raw: number }[] = [];

  for (const cols of parseTsv(text)) {
    const id = cols[0];
    const name = cols[1];
    const country_id = cols[8];
    if (!id || !name || !country_id || !countries.has(country_id)) continue;

    const admin1Code = cols[10] || null;
    const population = Number(cols[14]) || 0;
    const iso3 = countries.get(country_id)!.iso3;

    staged.push({
      raw: cityRarityRaw(population, arrivals.get(iso3) ?? null, bounds),
      row: {
        id,
        name,
        ascii_name: cols[2] ?? name,
        // GeoNames ships every exonym and transliteration; the first few carry the
        // ones people actually type. Keeping all of them would triple the FTS index.
        alt: (cols[3] ?? '').split(',').slice(0, 6).join(' '),
        country_id,
        admin1_code: admin1Code,
        admin1_name: admin1Code ? (admin1.get(`${country_id}.${admin1Code}`) ?? null) : null,
        population,
        lat: Number(cols[4]),
        lng: Number(cols[5]),
        timezone: cols[17] ?? null,
      },
    });
  }

  const toPercentile = percentileScale(staged.map((s) => s.raw));

  db.transaction(() => {
    for (const { row, raw } of staged) {
      insert.run({ ...row, rarity: toPercentile(raw) });
    }
  })();

  const count = staged.length;

  // Use each country's largest city as its map anchor. Not a true centroid, but it
  // is where you want the camera to land, which is what the coordinate is for.
  db.exec(`
    UPDATE countries SET
      lat = COALESCE((SELECT lat FROM cities WHERE country_id = countries.id ORDER BY population DESC LIMIT 1), 0),
      lng = COALESCE((SELECT lng FROM cities WHERE country_id = countries.id ORDER BY population DESC LIMIT 1), 0);
  `);

  console.log(`  ${count} cities`);
}

/**
 * The NPS API's `designation` field does not reliably identify the 63 National
 * Parks, so these three units are corrected by hand. The value is how many of the
 * 63 the unit represents — normally one, but Sequoia & Kings Canyon is a single
 * administrative unit covering two parks.
 *
 * An exceptions table rather than a hardcoded list of all 62 codes: the regex gets
 * 59 right on its own and keeps working if a new park is designated properly, which
 * is the common case. Only the oddities need maintaining.
 */
const NATIONAL_PARK_EXCEPTIONS: Record<string, number> = {
  redw: 1, // "National and State Parks" — jointly administered with California.
  seki: 2, // One unit, two parks: Sequoia and Kings Canyon.
  npsa: 1, // National Park of American Samoa — designation is empty in the API.
};

async function loadParks(db: Database.Database) {
  const key = process.env.NPS_API_KEY;
  if (!key) {
    console.warn('· parks SKIPPED — set NPS_API_KEY to include them');
    return;
  }

  console.log('· parks');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO parks (id, name, full_name, designation, states, lat, lng, is_national_park, is_monument)
    VALUES (@id, @name, @full_name, @designation, @states, @lat, @lng, @is_national_park, @is_monument)
  `);

  let start = 0;
  let total = Infinity;
  let count = 0;

  while (start < total) {
    const res = await fetchJson<any>(
      `https://developer.nps.gov/api/v1/parks?limit=200&start=${start}&api_key=${key}`
    );
    total = Number(res.total);

    db.transaction(() => {
      for (const p of res.data ?? []) {
        const designation: string = p.designation ?? '';
        insert.run({
          id: p.parkCode,
          name: p.name ?? p.fullName,
          full_name: p.fullName ?? p.name,
          designation,
          states: p.states ?? '',
          lat: Number(p.latitude) || 0,
          lng: Number(p.longitude) || 0,
          // Holds a count, not a boolean: 0 for anything that is not one of the 63,
          // 1 normally, and 2 for the one unit that covers two parks.
          is_national_park:
            NATIONAL_PARK_EXCEPTIONS[p.parkCode] ??
            // "National Park" and "National Park & Preserve" both count toward the
            // 63; "National Historical Park" must not, hence the anchored match.
            (/^National Park( & Preserve)?$/.test(designation) ? 1 : 0),
          is_monument: /National Monument/.test(designation) ? 1 : 0,
        });
        count++;
      }
    })();

    start += 200;
  }

  console.log(`  ${count} NPS units`);
}

function loadLandmarks(db: Database.Database) {
  console.log('· landmarks');
  const insert = db.prepare(`
    INSERT INTO landmarks (id, name, kind, country_id, lat, lng, extant)
    VALUES (@id, @name, @kind, @countryId, @lat, @lng, @extant)
  `);
  db.transaction(() => {
    for (const w of WONDERS) insert.run({ ...w, extant: w.extant ? 1 : 0 });
  })();
  console.log(`  ${WONDERS.length} wonders`);
}

function summarise() {
  const db = new Database(OUT_PATH, { readonly: true });
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM countries) c,
              (SELECT COUNT(*) FROM cities) ct,
              (SELECT COUNT(*) FROM parks) p,
              (SELECT COUNT(*) FROM landmarks) l`
    )
    .get() as any;
  db.close();

  const bytes = statSync(OUT_PATH).size;
  console.log(
    `\n✓ ${OUT_PATH}\n  ${counts.c} countries · ${counts.ct} cities · ${counts.p} parks · ${counts.l} landmarks · ${(bytes / 1e6).toFixed(1)} MB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
