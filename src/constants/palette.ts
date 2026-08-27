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
 * OpenFreeMap serves OpenStreetMap vector tiles with no API key, no registration and
 * no request cap, which is what makes a free travel app possible at all — every
 * commercial tile provider would meter this. Attribution is required and rendered in
 * the map's ornament bar.
 */
export const BASEMAP_TILE_URL = 'https://tiles.openfreemap.org/planet';

/** Glyphs for map labels; served from the same host as the tiles. */
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
