import type { City, Country, Landmark, Park } from '../db/reference';
import { byContinent, explorerScore, landAreaProgress } from './stats';

/**
 * Badge definitions.
 *
 * Each badge is a pure predicate over a snapshot of what the user has visited, plus
 * a `progress` function so the UI can show "7 / 10" on the ones not yet earned —
 * a locked badge with no visible distance to it is just a grey square.
 *
 * The mix is deliberate. Count milestones ("50 countries") reward volume and are the
 * easy dopamine; the rarity and geography badges ("Road Less Travelled", "Polar
 * Circle") reward the kind of travel that a pure counter is blind to, which is the
 * whole reason this app exists rather than a tally in the Notes app.
 */

export type BadgeContext = {
  countries: Country[];
  parks: Park[];
  landmarks: Landmark[];
  visitedCountryIds: Set<string>;
  visitedCities: City[];
  visitedParkIds: Set<string>;
  visitedLandmarkIds: Set<string>;
};

export type BadgeDef = {
  code: string;
  name: string;
  description: string;
  emoji: string;
  group: 'milestone' | 'geography' | 'rarity' | 'collection';
  /** Current value and the target it must reach. Earned when current >= target. */
  progress: (ctx: BadgeContext) => { current: number; target: number };
};

const countriesAt = (target: number): BadgeDef['progress'] => (ctx) => ({
  current: ctx.visitedCountryIds.size,
  target,
});

const citiesAt = (target: number): BadgeDef['progress'] => (ctx) => ({
  current: ctx.visitedCities.length,
  target,
});

/**
 * Small island developing states and island microstates. Hardcoded because "is this
 * country an island" is a surprisingly contested question that no dataset we ship
 * answers cleanly, and the list is stable enough to maintain by hand.
 */
const ISLAND_NATIONS = new Set([
  'AG','BS','BB','BH','CV','KM','CU','CY','DM','DO','FJ','GD','HT','IS','IE','JM','JP','KI','MG',
  'MV','MT','MH','MU','FM','NR','NZ','PW','PG','PH','WS','ST','SC','SG','SB','LK','KN','LC','VC',
  'TL','TO','TT','TV','VU','GB','ID','BN','CK','NU',
]);

export const BADGES: BadgeDef[] = [
  // Milestones — volume.
  { code: 'first-steps', name: 'First Steps', description: 'Record your first country.', emoji: '👣', group: 'milestone', progress: countriesAt(1) },
  { code: 'ten-countries', name: 'Getting Around', description: 'Visit 10 countries.', emoji: '🗺️', group: 'milestone', progress: countriesAt(10) },
  { code: 'twentyfive-countries', name: 'Frequent Flyer', description: 'Visit 25 countries.', emoji: '✈️', group: 'milestone', progress: countriesAt(25) },
  { code: 'fifty-countries', name: 'Half Century', description: 'Visit 50 countries.', emoji: '🎖️', group: 'milestone', progress: countriesAt(50) },
  { code: 'hundred-countries', name: 'Century Club', description: 'Visit 100 countries.', emoji: '💯', group: 'milestone', progress: countriesAt(100) },
  { code: 'hundred-cities', name: 'City Collector', description: 'Visit 100 cities.', emoji: '🏙️', group: 'milestone', progress: citiesAt(100) },

  // Geography — where, not how many.
  {
    code: 'all-continents',
    name: 'Seven Continents',
    description: 'Set foot on every continent, Antarctica included.',
    emoji: '🌍',
    group: 'geography',
    progress: (ctx) => ({
      current: byContinent(ctx.countries, ctx.visitedCountryIds).filter((c) => c.done > 0).length,
      target: 7,
    }),
  },
  {
    code: 'quarter-of-earth',
    name: 'A Quarter of Earth',
    description: 'Visit countries covering 25% of the world’s land area.',
    emoji: '🧭',
    group: 'geography',
    progress: (ctx) => ({
      current: Math.floor(landAreaProgress(ctx.countries, ctx.visitedCountryIds).pct),
      target: 25,
    }),
  },
  {
    code: 'polar-circle',
    name: 'Polar Circle',
    description: 'Visit a city inside the Arctic or Antarctic Circle.',
    emoji: '🧊',
    group: 'geography',
    // 66.5° is the latitude at which the sun stays up for a full day at solstice —
    // the actual thing that makes crossing it feel like an achievement.
    progress: (ctx) => ({
      current: ctx.visitedCities.some((c) => Math.abs(c.lat) >= 66.5) ? 1 : 0,
      target: 1,
    }),
  },
  {
    code: 'equator',
    name: 'On the Line',
    description: 'Visit a city within 1° of the equator.',
    emoji: '➖',
    group: 'geography',
    progress: (ctx) => ({
      current: ctx.visitedCities.some((c) => Math.abs(c.lat) <= 1) ? 1 : 0,
      target: 1,
    }),
  },
  {
    code: 'island-hopper',
    name: 'Island Hopper',
    description: 'Visit 10 island nations.',
    emoji: '🏝️',
    group: 'geography',
    progress: (ctx) => ({
      current: [...ctx.visitedCountryIds].filter((id) => ISLAND_NATIONS.has(id)).length,
      target: 10,
    }),
  },

  // Rarity — the part a country counter cannot see.
  {
    code: 'road-less-travelled',
    name: 'Road Less Travelled',
    description: 'Visit 10 cities with a rarity of 80 or above.',
    emoji: '🥾',
    group: 'rarity',
    progress: (ctx) => ({
      current: ctx.visitedCities.filter((c) => c.rarity >= 80).length,
      target: 10,
    }),
  },
  {
    code: 'off-the-map',
    name: 'Off the Map',
    description: 'Reach an average rarity of 70 across at least 20 cities.',
    emoji: '🛰️',
    group: 'rarity',
    // Gated on 20 cities so a single trip to one obscure town cannot mint it.
    progress: (ctx) => ({
      current:
        ctx.visitedCities.length >= 20 ? explorerScore(ctx.visitedCities).average : 0,
      target: 70,
    }),
  },

  // Collections — finite, checkable lists.
  {
    code: 'modern-wonders',
    name: 'Seven Wonders',
    description: 'See all seven New7Wonders of the World.',
    emoji: '🏛️',
    group: 'collection',
    progress: (ctx) => collection(ctx, (l) => l.kind === 'wonder_new'),
  },
  {
    code: 'natural-wonders',
    name: 'Wonders of Nature',
    description: 'See all seven New7Wonders of Nature.',
    emoji: '🌋',
    group: 'collection',
    progress: (ctx) => collection(ctx, (l) => l.kind === 'wonder_nature'),
  },
  {
    code: 'park-ranger',
    name: 'Park Ranger',
    description: 'Visit 10 US National Parks.',
    emoji: '🌲',
    group: 'collection',
    progress: (ctx) => ({
      current: ctx.parks
        .filter((p) => p.is_national_park >= 1 && ctx.visitedParkIds.has(p.id))
        .reduce((sum, p) => sum + p.is_national_park, 0),
      target: 10,
    }),
  },
  {
    code: 'park-completionist',
    name: 'The Full 63',
    description: 'Visit all 63 US National Parks.',
    emoji: '🦬',
    group: 'collection',
    progress: (ctx) => {
      const all = ctx.parks.filter((p) => p.is_national_park >= 1);
      return {
        current: all
          .filter((p) => ctx.visitedParkIds.has(p.id))
          .reduce((sum, p) => sum + p.is_national_park, 0),
        target: all.reduce((sum, p) => sum + p.is_national_park, 0),
      };
    },
  },
  {
    code: 'monument-hunter',
    name: 'Monument Hunter',
    description: 'Visit 25 US National Monuments.',
    emoji: '🗿',
    group: 'collection',
    progress: (ctx) => ({
      current: ctx.parks.filter((p) => p.is_monument === 1 && ctx.visitedParkIds.has(p.id)).length,
      target: 25,
    }),
  },
];

function collection(ctx: BadgeContext, match: (l: Landmark) => boolean) {
  const list = ctx.landmarks.filter(match);
  return { current: list.filter((l) => ctx.visitedLandmarkIds.has(l.id)).length, target: list.length };
}

export type BadgeState = BadgeDef & {
  current: number;
  target: number;
  earned: boolean;
  /** 0–1, for the ring on the badge tile. */
  fraction: number;
};

export function evaluateBadges(ctx: BadgeContext): BadgeState[] {
  return BADGES.map((def) => {
    const { current, target } = def.progress(ctx);
    return {
      ...def,
      current,
      target,
      // A target of 0 means the catalogue for that collection is empty — most often
      // parks before an NPS key has been supplied. Treat it as unearnable rather
      // than dividing by zero and awarding it to everyone.
      earned: target > 0 && current >= target,
      fraction: target > 0 ? Math.min(1, current / target) : 0,
    };
  });
}

/** Codes newly satisfied since the last evaluation, for the unlock animation. */
export function newlyEarned(states: BadgeState[], alreadyEarned: Set<string>): BadgeState[] {
  return states.filter((s) => s.earned && !alreadyEarned.has(s.code));
}
