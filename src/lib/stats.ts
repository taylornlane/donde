import type { City, Country, Landmark, Park } from '../db/reference';

/**
 * Pure derivations for the stats screen. Everything here takes plain data and a set
 * of visited ids and returns numbers — no hooks, no database, no store — so the
 * arithmetic that the whole app's sense of progress rests on can be unit tested
 * without a simulator.
 */

export type Percentage = { done: number; total: number; pct: number };

const pct = (done: number, total: number): Percentage => ({
  done,
  total,
  pct: total > 0 ? (done / total) * 100 : 0,
});

/**
 * "195 countries" is the familiar number: 193 UN members plus the two permanent
 * observers, Vatican City and Palestine. Our catalogue also carries dependencies
 * and territories, which are worth letting people tick off but would make the
 * headline percentage unrecognisable — so the denominator is UN-recognised states
 * and the territories are counted separately.
 */
export function countryProgress(countries: Country[], visited: Set<string>) {
  const sovereign = countries.filter((c) => c.un_member === 1);
  const territories = countries.filter((c) => c.un_member !== 1);

  return {
    sovereign: pct(sovereign.filter((c) => visited.has(c.id)).length, sovereign.length),
    territories: pct(territories.filter((c) => visited.has(c.id)).length, territories.length),
    all: pct(countries.filter((c) => visited.has(c.id)).length, countries.length),
  };
}

/**
 * Share of the world's land you have set foot in, by area of the countries visited.
 *
 * Antarctica is excluded from the denominator. At 14M km² it is a tenth of all land
 * and almost nobody goes, so leaving it in silently caps everyone's score around
 * 90% and makes the number feel broken rather than hard-won.
 */
export function landAreaProgress(countries: Country[], visited: Set<string>): Percentage {
  const eligible = countries.filter((c) => c.id !== 'AQ');
  const total = eligible.reduce((sum, c) => sum + c.area_km2, 0);
  const done = eligible
    .filter((c) => visited.has(c.id))
    .reduce((sum, c) => sum + c.area_km2, 0);
  return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
}

/** "You've been to countries that hold 43% of the world's people." */
export function populationReach(countries: Country[], visited: Set<string>): Percentage {
  const total = countries.reduce((sum, c) => sum + c.population, 0);
  const done = countries
    .filter((c) => visited.has(c.id))
    .reduce((sum, c) => sum + c.population, 0);
  return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
}

export function byContinent(countries: Country[], visited: Set<string>) {
  const groups = new Map<string, { visited: number; total: number }>();
  for (const c of countries) {
    const g = groups.get(c.continent) ?? { visited: 0, total: 0 };
    g.total++;
    if (visited.has(c.id)) g.visited++;
    groups.set(c.continent, g);
  }
  return [...groups.entries()]
    .map(([continent, g]) => ({ continent, ...pct(g.visited, g.total) }))
    .sort((a, b) => b.pct - a.pct || a.continent.localeCompare(b.continent));
}

/**
 * How much of one country you have explored.
 *
 * Two numbers, because they answer different questions and people want both. By
 * city count, visiting Kyoto and Osaka out of Japan's 700-odd catalogued cities is
 * under 1% — technically true and thoroughly demoralising. Weighted by population it
 * is nearer 5%, which better matches the intuition that you have seen a real part of
 * the country. We lead with the weighted figure and keep the raw count beside it.
 */
export function countryExploration(
  country: Country,
  citiesInCountry: City[],
  visitedCityIds: Set<string>
) {
  const visitedCities = citiesInCountry.filter((c) => visitedCityIds.has(c.id));
  const totalPop = citiesInCountry.reduce((s, c) => s + c.population, 0);
  const visitedPop = visitedCities.reduce((s, c) => s + c.population, 0);

  return {
    byCityCount: pct(visitedCities.length, citiesInCountry.length),
    byUrbanPopulation: {
      done: visitedPop,
      total: totalPop,
      pct: totalPop > 0 ? (visitedPop / totalPop) * 100 : 0,
    },
    visitedCities,
  };
}

export function parkProgress(parks: Park[], visited: Set<string>) {
  const nationalParks = parks.filter((p) => p.is_national_park === 1);
  const monuments = parks.filter((p) => p.is_monument === 1);
  return {
    nationalParks: pct(nationalParks.filter((p) => visited.has(p.id)).length, nationalParks.length),
    monuments: pct(monuments.filter((p) => visited.has(p.id)).length, monuments.length),
    allUnits: pct(parks.filter((p) => visited.has(p.id)).length, parks.length),
  };
}

export function wonderProgress(landmarks: Landmark[], visited: Set<string>) {
  const of = (kind: string) => {
    const list = landmarks.filter((l) => l.kind === kind);
    return pct(list.filter((l) => visited.has(l.id)).length, list.length);
  };
  return {
    modern: of('wonder_new'),
    ancient: of('wonder_ancient'),
    natural: of('wonder_nature'),
  };
}

/**
 * The headline number that distinguishes this from a country counter.
 *
 * A visit is worth its rarity, so 40 cities across the Sahel outscores 40 European
 * capitals. Normalising by the number of visits gives an average rather than a
 * total, which keeps it a measure of *how* you travel rather than how much — the
 * cumulative total is reported separately as `score`.
 */
export function explorerScore(visitedCities: City[]) {
  if (visitedCities.length === 0) return { score: 0, average: 0, rarest: null as City | null };

  const score = visitedCities.reduce((s, c) => s + c.rarity, 0);
  const rarest = visitedCities.reduce((a, b) => (b.rarity > a.rarity ? b : a));

  return {
    score,
    average: Math.round(score / visitedCities.length),
    rarest,
  };
}

/**
 * A blunt but readable label for the average rarity, used on the profile card. The
 * bands are chosen so that someone who has only done Western Europe and the US
 * lands in "Well-Travelled" rather than at the bottom — the point is to flatter
 * honestly and give a direction to climb, not to scold.
 */
export function explorerTier(average: number): string {
  if (average >= 75) return 'Off the Map';
  if (average >= 62) return 'Pathfinder';
  if (average >= 50) return 'Explorer';
  if (average >= 38) return 'Well-Travelled';
  return 'Tourist';
}
