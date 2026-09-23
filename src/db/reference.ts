import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * The place catalogue: ~250 countries, ~50k cities, every NPS unit, and the
 * wonders/heritage lists. Built offline by tools/ and shipped as a binary asset,
 * so the app works with no network and no server.
 *
 * It is strictly read-only. Nothing the user does writes here, which is why we can
 * throw the whole file away and replace it whenever we ship new data — user rows in
 * user.db reference these by string id and survive untouched.
 */

const DB_NAME = 'reference.db';

/** Bumped in app.json whenever tools/ regenerates the catalogue. */
const BUNDLED_VERSION: number = Constants.expoConfig?.extra?.referenceDbVersion ?? 1;

let handle: SQLiteDatabase | null = null;

/**
 * Copies the bundled catalogue into the SQLite directory if it is missing or stale.
 * Cheap on every launch after the first: a version comparison and nothing else.
 */
export async function openReferenceDb(): Promise<SQLiteDatabase> {
  if (handle) return handle;

  const dir = new Directory(Paths.document, 'SQLite');
  if (!dir.exists) dir.create({ intermediates: true });

  const target = new File(dir, DB_NAME);

  if (!target.exists || readInstalledVersion(dir) !== BUNDLED_VERSION) {
    const asset = Asset.fromModule(require('../../assets/data/reference.db'));
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('reference.db asset has no local URI');

    if (target.exists) target.delete();
    new File(asset.localUri).copy(target);
    writeInstalledVersion(dir, BUNDLED_VERSION);
  }

  handle = openDatabaseSync(DB_NAME);
  return handle;
}

/**
 * Version tracking lives in a sidecar file rather than in user.db, so that clearing
 * user data never tricks us into thinking a stale catalogue is current.
 */
function readInstalledVersion(dir: Directory): number | null {
  const marker = new File(dir, 'reference.version');
  if (!marker.exists) return null;
  const parsed = Number(marker.textSync().trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function writeInstalledVersion(dir: Directory, version: number) {
  const marker = new File(dir, 'reference.version');
  if (marker.exists) marker.delete();
  marker.create();
  marker.write(String(version));
}

function ref(): SQLiteDatabase {
  if (!handle) throw new Error('Reference DB not open — await openReferenceDb() first');
  return handle;
}

// ---------------------------------------------------------------------------
// Row shapes, mirroring the tables tools/build-reference-db.ts emits.
// ---------------------------------------------------------------------------

export type Country = {
  id: string; // ISO 3166-1 alpha-2
  iso3: string;
  name: string;
  continent: string;
  region: string | null;
  capital: string | null;
  population: number;
  area_km2: number;
  lat: number;
  lng: number;
  un_member: number;
  emoji: string;
  city_count: number;
};

export type City = {
  id: string; // GeoNames id
  name: string;
  country_id: string;
  admin1_name: string | null;
  population: number;
  lat: number;
  lng: number;
  /** 1–100, higher means more off the beaten path. See tools/rarity.ts. */
  rarity: number;
};

export type Park = {
  id: string; // NPS parkCode
  name: string;
  full_name: string;
  designation: string;
  states: string;
  lat: number;
  lng: number;
  is_national_park: number;
  is_monument: number;
};

/** Must stay in step with the `kind` values tools/src/wonders.ts emits. */
export type LandmarkKind = 'wonder_new' | 'wonder_ancient' | 'wonder_nature' | 'unesco';

export type Landmark = {
  id: string;
  name: string;
  kind: LandmarkKind;
  country_id: string;
  lat: number;
  lng: number;
};

// ---------------------------------------------------------------------------
// Queries. All read-only and parameterised.
// ---------------------------------------------------------------------------

export function allCountries(): Promise<Country[]> {
  return ref().getAllAsync<Country>('SELECT * FROM countries ORDER BY name');
}

export function countriesByIds(ids: string[]): Promise<Country[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return ref().getAllAsync<Country>(
    `SELECT * FROM countries WHERE id IN (${placeholders(ids.length)}) ORDER BY name`,
    ids
  );
}

export function citiesInCountry(countryId: string, limit = 500, offset = 0): Promise<City[]> {
  return ref().getAllAsync<City>(
    `SELECT * FROM cities WHERE country_id = ?
     ORDER BY population DESC LIMIT ? OFFSET ?`,
    [countryId, limit, offset]
  );
}

export function citiesByIds(ids: string[]): Promise<City[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return ref().getAllAsync<City>(
    `SELECT * FROM cities WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
}

/**
 * Full-text city search. FTS5 gives us prefix matching over both the local name and
 * the ASCII fold, so "koln", "köln" and "colo" all reach Köln. Ranked by relevance
 * first and population second, because searching "san" should surface San Francisco
 * long before San Fernando de Apure.
 */
export function searchCities(query: string, limit = 40): Promise<City[]> {
  const term = toFtsPrefixQuery(query);
  if (!term) return Promise.resolve([]);
  return ref().getAllAsync<City>(
    `SELECT c.* FROM cities_fts f
     JOIN cities c ON c.rowid = f.rowid
     WHERE cities_fts MATCH ?
     ORDER BY bm25(cities_fts), c.population DESC
     LIMIT ?`,
    [term, limit]
  );
}

/**
 * The same FTS search, ordered by rarity instead of relevance — "show me the
 * obscure ones". A population floor keeps the results to places you could plausibly
 * plan a trip around: without it the top of the list is hamlets in the Sahel that
 * happen to clear the 15,000 threshold, which is technically correct and useless.
 */
export function searchCitiesByRarity(query: string, limit = 40): Promise<City[]> {
  const term = toFtsPrefixQuery(query);
  if (!term) return Promise.resolve([]);
  return ref().getAllAsync<City>(
    `SELECT c.* FROM cities_fts f
     JOIN cities c ON c.rowid = f.rowid
     WHERE cities_fts MATCH ? AND c.population >= 50000
     ORDER BY c.rarity DESC, c.population DESC
     LIMIT ?`,
    [term, limit]
  );
}

/** Browse the rarest places overall, for when you have no particular search in mind. */
export function rarestCities(limit = 60, minPopulation = 100000): Promise<City[]> {
  return ref().getAllAsync<City>(
    `SELECT * FROM cities WHERE population >= ?
     ORDER BY rarity DESC, population DESC LIMIT ?`,
    [minPopulation, limit]
  );
}

export function searchCountries(query: string, limit = 20): Promise<Country[]> {
  const like = `%${query.trim()}%`;
  return ref().getAllAsync<Country>(
    `SELECT * FROM countries WHERE name LIKE ? OR iso3 LIKE ? OR id LIKE ?
     ORDER BY population DESC LIMIT ?`,
    [like, like, like, limit]
  );
}

/** Cities inside the current viewport, biggest first — powers "browse to remember". */
export function citiesInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  limit = 300
): Promise<City[]> {
  return ref().getAllAsync<City>(
    `SELECT * FROM cities
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
     ORDER BY population DESC LIMIT ?`,
    [bounds.south, bounds.north, bounds.west, bounds.east, limit]
  );
}

export function allParks(): Promise<Park[]> {
  return ref().getAllAsync<Park>('SELECT * FROM parks ORDER BY name');
}

export function allLandmarks(kind?: LandmarkKind): Promise<Landmark[]> {
  return kind
    ? ref().getAllAsync<Landmark>('SELECT * FROM landmarks WHERE kind = ? ORDER BY name', [kind])
    : ref().getAllAsync<Landmark>('SELECT * FROM landmarks ORDER BY name');
}

/** Denominators for the stats screen, read once rather than counted per render. */
export function catalogueTotals(): Promise<{
  countries: number;
  unMembers: number;
  cities: number;
  nationalParks: number;
  monuments: number;
  npsUnits: number;
  landWithoutAntarcticaKm2: number;
}> {
  return ref()
    .getFirstAsync<any>(
      `SELECT
         (SELECT COUNT(*) FROM countries)                        AS countries,
         (SELECT COUNT(*) FROM countries WHERE un_member = 1)    AS unMembers,
         (SELECT COUNT(*) FROM cities)                           AS cities,
         (SELECT COUNT(*) FROM parks WHERE is_national_park = 1) AS nationalParks,
         (SELECT COUNT(*) FROM parks WHERE is_monument = 1)      AS monuments,
         (SELECT COUNT(*) FROM parks)                            AS npsUnits,
         (SELECT SUM(area_km2) FROM countries WHERE id != 'AQ')  AS landWithoutAntarcticaKm2`
    )
    .then((row) => row!);
}

// ---------------------------------------------------------------------------

function placeholders(n: number): string {
  return new Array(n).fill('?').join(',');
}

/**
 * FTS5 treats most punctuation as syntax, so a raw user string like "St. John's"
 * is a syntax error rather than a search. Strip to word characters, then make the
 * final token a prefix match so results narrow as you type.
 */
function toFtsPrefixQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : t)).join(' ');
}
