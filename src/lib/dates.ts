import type { Visit } from '../db/schema';

/**
 * Partial ISO dates — "2019", "2019-04", "2019-04-12".
 *
 * Everything here is string work rather than Date arithmetic on purpose. A real
 * Date cannot represent "sometime in 2019" without inventing a January 1st that
 * would then show up in a "what did I do in January" breakdown as a lie.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "April 2019", or just "2019" when that is all that was recorded. */
export function formatVisitDate(visitedOn: string | null | undefined): string {
  if (!visitedOn) return '';
  const year = visitedOn.slice(0, 4);
  if (visitedOn.length < 7) return year;

  const month = MONTH_NAMES[Number(visitedOn.slice(5, 7)) - 1];
  if (!month) return year;
  if (visitedOn.length < 10) return `${month} ${year}`;

  return `${Number(visitedOn.slice(8, 10))} ${month} ${year}`;
}

export function yearOf(visitedOn: string | null | undefined): number | null {
  if (!visitedOn) return null;
  const year = Number(visitedOn.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** 1–12, or null when only a year was recorded. */
export function monthOf(visitedOn: string | null | undefined): number | null {
  if (!visitedOn || visitedOn.length < 7) return null;
  const month = Number(visitedOn.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

export type YearSummary = {
  year: number;
  countries: number;
  cities: number;
  parks: number;
  landmarks: number;
  total: number;
};

/**
 * Groups dated visits by year, newest first.
 *
 * Undated visits are excluded rather than bucketed into a catch-all. A year
 * breakdown is a claim about when things happened, and quietly filing unknowns
 * under the current year would make that claim false — `undated` is reported
 * separately so the gap stays visible and fixable.
 */
export function byYear(visits: Visit[]): { years: YearSummary[]; undated: number } {
  const buckets = new Map<number, YearSummary>();
  let undated = 0;

  for (const visit of visits) {
    const year = yearOf(visit.visitedOn);
    if (year === null) {
      undated++;
      continue;
    }

    const bucket =
      buckets.get(year) ??
      { year, countries: 0, cities: 0, parks: 0, landmarks: 0, total: 0 };

    if (visit.kind === 'country') bucket.countries++;
    else if (visit.kind === 'city') bucket.cities++;
    else if (visit.kind === 'park') bucket.parks++;
    else bucket.landmarks++;
    bucket.total++;

    buckets.set(year, bucket);
  }

  return {
    years: [...buckets.values()].sort((a, b) => b.year - a.year),
    undated,
  };
}

/**
 * Which months you travel in, across every year — counts per calendar month,
 * index 0 = January. Only visits recorded with a month contribute.
 */
export function byMonth(visits: Visit[]): number[] {
  const counts = new Array(12).fill(0);
  for (const visit of visits) {
    const month = monthOf(visit.visitedOn);
    if (month !== null) counts[month - 1]++;
  }
  return counts;
}

/** The busiest travel year, for the headline. Null when nothing is dated. */
export function busiestYear(years: YearSummary[]): YearSummary | null {
  if (years.length === 0) return null;
  return years.reduce((a, b) => (b.total > a.total ? b : a));
}
