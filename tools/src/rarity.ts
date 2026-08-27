/**
 * Rarity scoring: 1 (everybody goes) → 100 (almost nobody does).
 *
 * The honest way to score rarity is "what fraction of our users have been here",
 * but on day one there are no users, so we need a cold-start prior that already
 * feels right. Two signals get us most of the way:
 *
 *   1. City size. Tourism concentrates super-linearly in big cities, so a log of
 *      population is a decent stand-in for "how many people pass through".
 *   2. How touristed the country is. Paris and Ouagadougou are both capitals of
 *      roughly comparable metro size; what separates them is that France takes ~90M
 *      international arrivals a year and Burkina Faso takes well under a million.
 *
 * Neither is a substitute for real visit data. `blendWithObserved` is the seam where
 * that takes over once there are enough users to mean anything — see docs/PLAN.md.
 */

/** World Bank: international tourism, number of arrivals. Free, no key. */
export const TOURIST_ARRIVALS_URL =
  'https://api.worldbank.org/v2/country/all/indicator/ST.INT.ARVL?format=json&per_page=20000&mrnev=1';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Population → 0–100, where 100 is tiny. A 20M-person city lands near 10, a 100k
 * town near 40, and a 15k village near 55; the country term supplies the rest of
 * the spread, so this deliberately does not saturate at either end.
 */
export function populationComponent(population: number): number {
  if (population <= 0) return 70;
  return clamp(100 - 12 * Math.log10(population), 5, 80);
}

/**
 * Arrivals → 0–100, where 100 is untouristed. Log-scaled against the observed range
 * of the dataset (roughly 10k to 100M) rather than a fixed constant, so the score
 * keeps its spread if the underlying numbers shift.
 */
export function countryComponent(
  arrivals: number | null,
  bounds: { minLog: number; maxLog: number }
): number {
  // No data usually means a small or poorly-reported country, which skews rare —
  // but guessing 100 would crown every data gap the rarest place on earth.
  if (arrivals == null || arrivals <= 0) return 65;
  const l = Math.log10(arrivals);
  const normalised = (l - bounds.minLog) / (bounds.maxLog - bounds.minLog);
  return clamp(100 - normalised * 100, 0, 100);
}

/**
 * The blended prior, on an arbitrary scale. Not the number we ship — see
 * `percentileScale` for why it has to be ranked before it means anything.
 */
export function cityRarityRaw(
  population: number,
  arrivals: number | null,
  bounds: { minLog: number; maxLog: number }
): number {
  return 0.55 * populationComponent(population) + 0.45 * countryComponent(arrivals, bounds);
}

/**
 * Converts raw scores into percentile ranks across the whole catalogue.
 *
 * The raw blend is badly compressed in absolute terms — because the city dataset
 * has a population floor of 15,000 and most countries take a middling number of
 * tourists, real scores pile up between 35 and 50 and nothing ever reaches 80. A
 * user tapping through their visits would see every city rated "about 42", which
 * tells them nothing.
 *
 * Ranking fixes that by construction: rarity 90 means "rarer than 90% of the
 * cities we know about", which is both a legible sentence and evenly spread by
 * definition, so badge thresholds and tier bands can be set against it directly.
 */
export function percentileScale(rawScores: number[]): (raw: number) => number {
  const sorted = [...rawScores].sort((a, b) => a - b);
  const last = Math.max(1, sorted.length - 1);

  return (raw: number) => {
    // Lower bound: how many scores fall strictly below this one.
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! < raw) lo = mid + 1;
      else hi = mid;
    }
    return Math.round(clamp(1 + 99 * (lo / last), 1, 100));
  };
}

/**
 * Once real visit counts exist, they should dominate — but only where the sample is
 * big enough to trust. This is a Bayesian shrink: with few observations the prior
 * carries the score, and it hands over smoothly as evidence accumulates rather than
 * flipping at an arbitrary threshold.
 */
export function blendWithObserved(
  prior: number,
  observedVisitFraction: number,
  observationCount: number,
  confidenceAt = 500
): number {
  const weight = observationCount / (observationCount + confidenceAt);
  const observed = clamp(100 - observedVisitFraction * 100, 1, 100);
  return Math.round(prior * (1 - weight) + observed * weight);
}

/** Pulls the World Bank series into a plain ISO3 → arrivals map. */
export function parseArrivals(payload: unknown): Map<string, number> {
  const out = new Map<string, number>();
  // The API returns [metadata, rows]; rows is null when a query matches nothing.
  const rows = Array.isArray(payload) ? (payload[1] as any[] | null) : null;
  for (const row of rows ?? []) {
    const iso3: string | undefined = row?.countryiso3code;
    const value: number | null = row?.value;
    if (iso3 && typeof value === 'number' && value > 0) {
      out.set(iso3.toUpperCase(), Math.max(out.get(iso3.toUpperCase()) ?? 0, value));
    }
  }
  return out;
}

export function arrivalBounds(arrivals: Map<string, number>) {
  const logs = [...arrivals.values()].map((v) => Math.log10(v));
  return {
    minLog: logs.length ? Math.min(...logs) : 4,
    maxLog: logs.length ? Math.max(...logs) : 8,
  };
}
