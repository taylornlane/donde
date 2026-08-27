import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { Asset } from 'expo-asset';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { MapPalette } from '../constants/palette';
import type { City } from '../db/reference';
import { useVisitedIds } from '../stores/visits';
import { baseStyle, placeLabelLayer } from './style';

export type MapMode = 'countries' | 'cities';

type Props = {
  mode: MapMode;
  /** Cities the user has visited, already resolved from the catalogue. */
  visitedCities: City[];
  onPressCountry?: (countryId: string) => void;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
};

/**
 * The two maps the app is built around.
 *
 * `countries` fills a whole country the moment you have been anywhere in it — the
 * satisfying, fast-moving view. `cities` fills only the places you actually stood
 * in, which on a world map reads as a constellation of dots and is the honest one.
 * They share a camera and a base style so switching between them feels like a lens
 * change rather than a navigation.
 *
 * Both render from the same immutable sources. Toggling a visit changes only a layer
 * *filter*, never the source data, so marking a country does not re-upload 300KB of
 * polygons to the renderer — it flips which of two already-uploaded fill layers
 * claims that feature.
 */
export function WorldMap({ mode, visitedCities, onPressCountry, onViewportChange }: Props) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = MapPalette[scheme];
  const mapRef = useRef<MapRef>(null);

  const visitedCountryIds = useVisitedIds('country');
  const countriesUri = useCountryGeometryUri();

  // MapLibre filters need a plain array; the store holds a Set. Recomputed only when
  // the set identity changes, which the store guarantees is per-write rather than
  // per-render.
  const visitedCountryList = useMemo(() => [...visitedCountryIds], [visitedCountryIds]);

  const cityFeatures = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: visitedCities.map((c) => ({
        type: 'Feature' as const,
        id: c.id,
        properties: { id: c.id, name: c.name, rarity: c.rarity },
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      })),
    }),
    [visitedCities]
  );

  const style = useMemo(() => baseStyle(scheme), [scheme]);
  const labels = useMemo(() => placeLabelLayer(scheme), [scheme]);

  if (!countriesUri) return <View style={[styles.fill, { backgroundColor: colors.ocean }]} />;

  return (
    <Map
      ref={mapRef}
      style={styles.fill}
      mapStyle={style}
      onPress={async (event) => {
        if (!onPressCountry) return;
        const features = (event.nativeEvent as any).features;
        const hit = features?.find((f: any) => f?.properties?.id);
        if (hit) onPressCountry(hit.properties.id);
      }}
      // Fires once the gesture settles rather than on every frame of a pan, so a
      // viewport query runs once per movement instead of sixty times a second.
      onRegionDidChange={(e) => {
        // GeoJSON-RFC order: [west, south, east, north].
        const bounds = e.nativeEvent.bounds;
        if (!bounds) return;
        const [west, south, east, north] = bounds;
        onViewportChange?.({ north, south, east, west });
      }}
    >
      <Camera
        initialViewState={{ center: [10, 25], zoom: 1.4 }}
        // Zoom 0 lets the globe shrink into a corner of the viewport, which reads as
        // broken. 1.2 is the tightest fit that still shows every continent at once.
        minZoom={1.2}
        maxZoom={16}
      />

      <GeoJSONSource id="countries" data={countriesUri}>
        {/*
          Always drawn: the unvisited base. Giving every country a fill (rather than
          leaving gaps to the ocean) is what makes the visited ones read as *filled
          in* rather than as floating shapes.
        */}
        <Layer
          id="country-base"
          type="fill"
          paint={{ 'fill-color': colors.unvisited, 'fill-opacity': 1 }}
        />

        <Layer
          id="country-visited"
          type="fill"
          filter={['in', ['get', 'id'], ['literal', visitedCountryList]]}
          paint={{
            'fill-color': colors.visited,
            // In cities mode the country fill drops back to a wash so the city dots
            // are the figure and the country is ground — same data, inverted emphasis.
            'fill-opacity': mode === 'countries' ? 0.85 : 0.18,
          }}
        />

        <Layer
          id="country-outline"
          type="line"
          paint={{
            'line-color': colors.unvisitedBorder,
            'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 6, 1],
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource id="visited-cities" data={cityFeatures}>
        {/*
          A white ring under each dot keeps clustered cities distinguishable when a
          dozen of them overlap across a small country.
        */}
        <Layer
          id="city-halo"
          type="circle"
          layout={{ visibility: mode === 'cities' ? 'visible' : 'none' }}
          paint={{
            'circle-color': colors.cityHalo,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.2, 6, 6.5, 12, 13],
            'circle-opacity': 0.9,
          }}
        />
        <Layer
          id="city-dot"
          type="circle"
          layout={{ visibility: mode === 'cities' ? 'visible' : 'none' }}
          paint={{
            'circle-color': colors.city,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2, 6, 4.5, 12, 10],
            'circle-stroke-color': colors.visitedBorder,
            'circle-stroke-width': 0.5,
          }}
        />
      </GeoJSONSource>

      <Layer {...labels} />
    </Map>
  );
}

/**
 * Resolves the bundled country polygons to a file URI once per app run.
 *
 * Handing MapLibre a URI rather than a parsed object means the 300KB of GeoJSON is
 * decoded natively, off the JS thread, and never occupies the bundle or the heap.
 */
function useCountryGeometryUri(): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Asset.fromModule(require('../../assets/data/countries.geojson'))
      .downloadAsync()
      .then((asset) => {
        if (!cancelled) setUri(asset.localUri ?? asset.uri);
      })
      .catch((err) => console.warn('Failed to load country geometry', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return uri;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
