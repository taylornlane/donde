import type {
  StyleSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native';

import { BASEMAP_TILE_URL, GLYPHS_URL, MapPalette, type MapColors } from '../constants/palette';

/**
 * The base map style, built by hand rather than pulled from a hosted style URL.
 *
 * Two reasons. First, offline: the world view — which is the whole point of this app
 * — has to render with no network, so the ocean and the country fills come from a
 * background layer and a bundled GeoJSON rather than from tiles. Street detail is
 * layered on above zoom 5, and its absence on a plane is a non-event.
 *
 * Second, restraint: an off-the-shelf basemap competes with the choropleth. Every
 * road casing and POI label is contrast the visited/unvisited distinction has to
 * fight through. This keeps roughly a dozen layers, so the thing the user came to
 * look at is the loudest thing on screen.
 *
 * Source layer names follow the OpenMapTiles schema that OpenFreeMap serves.
 */

/** Below this, the map is pure bundled geometry and needs no network at all. */
export const DETAIL_MINZOOM = 5;

export function baseStyle(scheme: 'light' | 'dark'): StyleSpecification {
  const c: MapColors = MapPalette[scheme];

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      basemap: { type: 'vector', url: BASEMAP_TILE_URL },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': c.ocean } },

      // Vector detail. All gated on DETAIL_MINZOOM so that panning the globe never
      // waits on a tile request.
      {
        id: 'detail-landcover',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        minzoom: DETAIL_MINZOOM,
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'ice']]],
        paint: { 'fill-color': c.unvisitedBorder, 'fill-opacity': 0.35 },
      },
      {
        id: 'detail-water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        minzoom: DETAIL_MINZOOM,
        paint: { 'fill-color': c.ocean },
      },
      {
        id: 'detail-roads',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        minzoom: DETAIL_MINZOOM + 2,
        filter: [
          'in',
          ['get', 'class'],
          ['literal', ['motorway', 'trunk', 'primary', 'secondary']],
        ],
        paint: {
          'line-color': c.unvisitedBorder,
          // Roads should hint at structure when you zoom into a city, not draw a
          // street atlas — hence sub-pixel widths until you are properly close in.
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1.6, 16, 4],
          'line-opacity': 0.7,
        },
      },
      {
        id: 'detail-buildings',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': c.unvisitedBorder, 'fill-opacity': 0.4 },
      },
    ],
  };
}

/**
 * Place labels live in their own factory so they can be inserted *above* the visited
 * layers. A city name buried under an orange fill is worse than no label at all, and
 * layer order in MapLibre is purely insertion order.
 */
export function placeLabelLayer(scheme: 'light' | 'dark'): SymbolLayerSpecification {
  const c = MapPalette[scheme];
  return {
    id: 'detail-place-labels',
    type: 'symbol',
    source: 'basemap',
    'source-layer': 'place',
    minzoom: DETAIL_MINZOOM,
    filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 15],
      'text-anchor': 'top' as const,
      'text-offset': [0, 0.6],
    },
    paint: {
      'text-color': c.label,
      'text-halo-color': c.labelHalo,
      'text-halo-width': 1.4,
    },
  };
}
