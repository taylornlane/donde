/**
 * Map palette.
 *
 * Kept separate from the UI theme in constants/theme.ts because these colours are
 * constrained by cartography rather than by chrome: `unvisited` has to read as land
 * without competing with `visited`, and `visited` has to stay legible against both
 * the ocean and its own border at every zoom level. Changing them to match a button
 * somewhere would break the map.
 */

export type MapColors = {
  ocean: string;
  /** Land you have not been to — present, but clearly background. */
  unvisited: string;
  unvisitedBorder: string;
  /** The payoff colour. Warm, saturated, unmistakably "yours". */
  visited: string;
  visitedBorder: string;
  city: string;
  cityHalo: string;
  label: string;
  labelHalo: string;
};

/**
 * Annotated rather than `as const`: the two schemes must stay structurally
 * identical, and widening the values to `string` is what lets a component take
 * whichever one the current appearance selects.
 */
export const MapPalette: Record<'light' | 'dark', MapColors> = {
  light: {
    ocean: '#DCE7EE',
    unvisited: '#F2F0EA',
    unvisitedBorder: '#C9CEC9',
    visited: '#E8703A',
    visitedBorder: '#B84E1F',
    city: '#E8703A',
    cityHalo: '#FFFFFF',
    label: '#3A4A54',
    labelHalo: '#FFFFFF',
  },
  dark: {
    ocean: '#0B1F2A',
    unvisited: '#1B2C35',
    unvisitedBorder: '#2C4049',
    visited: '#F2864B',
    visitedBorder: '#FFB185',
    city: '#FFC08A',
    cityHalo: '#0B1F2A',
    label: '#C7D6DE',
    labelHalo: '#0B1F2A',
  },
} as const;

/**
 * The colour your visited places are painted in.
 *
 * A fixed set rather than a colour wheel. On a map, an arbitrary RGB value is a
 * liability: half the spectrum disappears against the ocean, another slice is
 * indistinguishable from unvisited land, and pale picks make the border vanish. Each
 * accent below is hand-paired — a fill and a border that hold up over water and over
 * land, in both appearances — so every choice still reads as a map.
 *
 * Light and dark are separate values, not one colour dimmed. The dark scheme sits on
 * a near-black ocean, where the same hue needs more luminance to carry, and its
 * border runs *lighter* than the fill rather than darker.
 */
export type Accent = {
  id: string;
  name: string;
  light: { fill: string; border: string; city: string };
  dark: { fill: string; border: string; city: string };
};

export const ACCENTS: Accent[] = [
  {
    id: 'sunset',
    name: 'Sunset',
    light: { fill: '#E8703A', border: '#B84E1F', city: '#E8703A' },
    dark: { fill: '#F2864B', border: '#FFB185', city: '#FFC08A' },
  },
  {
    id: 'coral',
    name: 'Coral',
    light: { fill: '#E05263', border: '#AE2E3E', city: '#E05263' },
    dark: { fill: '#FF7B8A', border: '#FFB3BC', city: '#FFA8B3' },
  },
  {
    id: 'amber',
    name: 'Amber',
    light: { fill: '#D9A02C', border: '#A57413', city: '#C98F1E' },
    dark: { fill: '#F5BC55', border: '#FFDA9B', city: '#FFD285' },
  },
  {
    id: 'jade',
    name: 'Jade',
    light: { fill: '#2E9E6B', border: '#17704A', city: '#2E9E6B' },
    dark: { fill: '#4FC08D', border: '#9AE6C2', city: '#7FDCB0' },
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    light: { fill: '#1F93A8', border: '#0C6678', city: '#1F93A8' },
    dark: { fill: '#3FBCC9', border: '#93E4EC', city: '#6FD8E2' },
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    light: { fill: '#3B6FD8', border: '#1E47A0', city: '#3B6FD8' },
    dark: { fill: '#6E9CF0', border: '#B3CBFF', city: '#94B8FF' },
  },
  {
    id: 'violet',
    name: 'Violet',
    light: { fill: '#7B5CD6', border: '#53379F', city: '#7B5CD6' },
    dark: { fill: '#9E82F0', border: '#CDBCFF', city: '#B9A3FF' },
  },
  {
    id: 'plum',
    name: 'Plum',
    light: { fill: '#BE4593', border: '#8C2268', city: '#BE4593' },
    dark: { fill: '#E06BBB', border: '#F7B4E0', city: '#F095D2' },
  },
];

export const DEFAULT_ACCENT_ID = 'sunset';

export function accentById(id: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}

/**
 * The base scheme with the chosen accent folded in. Everything that paints a visited
 * country, a city dot, a progress bar or a checked row reads its colour from here, so
 * changing the accent recolours the whole app rather than only the map.
 */
export function resolveColors(scheme: 'light' | 'dark', accentId: string): MapColors {
  const accent = accentById(accentId)[scheme];
  return {
    ...MapPalette[scheme],
    visited: accent.fill,
    visitedBorder: accent.border,
    city: accent.city,
  };
}

/**
 * OpenFreeMap serves OpenStreetMap vector tiles with no API key, no registration and
 * no request cap, which is what makes a free travel app possible at all — every
 * commercial tile provider would meter this. Attribution is required and rendered in
 * the map's ornament bar.
 */
export const BASEMAP_TILE_URL = 'https://tiles.openfreemap.org/planet';

/** Glyphs for map labels; served from the same host as the tiles. */
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
