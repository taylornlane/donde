import type { City } from '../db/reference';

/**
 * Making the rarity percentile legible.
 *
 * The raw number is meaningless on its own — "rarity 63" tells you nothing unless
 * you already know the distribution. These bands turn it into a claim a person can
 * actually check against their own sense of a place: Paris is Common, Reykjavík is
 * Rare, N'Djamena is Remote. If a band ever contradicts your intuition about a
 * place, that's a bug in the scoring, and the label is what makes it visible.
 */

export type RarityBand = {
  key: 'common' | 'uncommon' | 'rare' | 'remote';
  label: string;
  /** Plain-language gloss, used as the tooltip/subtitle wherever there is room. */
  blurb: string;
  /** 1–4, for the segmented meter. */
  steps: number;
};

const BANDS: RarityBand[] = [
  {
    key: 'common',
    label: 'Common',
    blurb: 'A place most travellers pass through',
    steps: 1,
  },
  {
    key: 'uncommon',
    label: 'Uncommon',
    blurb: 'Off the main circuit, but well travelled',
    steps: 2,
  },
  {
    key: 'rare',
    label: 'Rare',
    blurb: 'Few visitors get here',
    steps: 3,
  },
  {
    key: 'remote',
    label: 'Remote',
    blurb: 'Among the least visited places on earth',
    steps: 4,
  },
];

/**
 * Thresholds are set against the percentile, so each band is a fixed slice of the
 * catalogue: roughly a third Common, a third Uncommon, a quarter Rare, and the top
 * 15% Remote. Deliberately not even quarters — "Remote" should feel earned.
 */
export function rarityBand(rarity: number): RarityBand {
  if (rarity >= 85) return BANDS[3]!;
  if (rarity >= 60) return BANDS[2]!;
  if (rarity >= 30) return BANDS[1]!;
  return BANDS[0]!;
}

export const ALL_BANDS = BANDS;

/** How your visited cities spread across the bands, for the stats breakdown. */
export function bandDistribution(cities: City[]) {
  const counts = new Map<RarityBand['key'], number>(BANDS.map((b) => [b.key, 0]));
  for (const city of cities) {
    const band = rarityBand(city.rarity);
    counts.set(band.key, (counts.get(band.key) ?? 0) + 1);
  }
  return BANDS.map((band) => ({
    band,
    count: counts.get(band.key) ?? 0,
    fraction: cities.length > 0 ? (counts.get(band.key) ?? 0) / cities.length : 0,
  }));
}

/**
 * The "you vs everyone else" line.
 *
 * Built from the same arrivals figures that feed the score, so it is a statement
 * about the world rather than about other dónde users — which matters, because
 * there aren't any yet. Deliberately vague about exact numbers: the arrivals data
 * is a few years stale and precise-sounding claims from stale data are worse than
 * honestly approximate ones.
 */
export function comparisonLine(cities: City[]): string | null {
  if (cities.length === 0) return null;

  const offBeaten = cities.filter((c) => c.rarity >= 60).length;
  const share = Math.round((offBeaten / cities.length) * 100);

  if (share >= 60) {
    return `${share}% of the places you've been are ones few travellers reach.`;
  }
  if (share >= 30) {
    return `${share}% of your cities are off the main tourist circuit.`;
  }
  if (offBeaten > 0) {
    return `${offBeaten} of your ${cities.length} cities are well off the beaten path.`;
  }
  return `You've stuck to well-travelled places so far — the rarest is ${
    cities.reduce((a, b) => (b.rarity > a.rarity ? b : a)).name
  }.`;
}
