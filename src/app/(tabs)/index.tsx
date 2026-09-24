import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccentPicker } from '@/components/accent-picker';
import type { MapColors } from '@/constants/palette';
import { useMapColors } from '@/hooks/use-map-colors';
import { citiesInBounds, type City } from '@/db/reference';
import { useCatalogue } from '@/lib/catalogue';
import { WorldMap, type MapMode } from '@/map/WorldMap';
import { useVisitCount, useVisits } from '@/stores/visits';

/**
 * The home screen: one map, two lenses, switched by the segmented control that sits
 * over it. The counter beneath the switch is doing real work — it is the number the
 * user opens the app to see, so it stays on screen rather than living in Stats.
 */
export default function MapScreen() {
  const [mode, setMode] = useState<MapMode>('countries');
  const [pickerOpen, setPickerOpen] = useState(false);
  const colors = useMapColors();

  const visitedCities = useCatalogue((s) => s.visitedCities);
  const countryCount = useVisitCount('country');
  const cityCount = useVisitCount('city');
  const toggle = useVisits((s) => s.toggle);
  const onPressCity = useCallback((id: string) => toggle('city', id), [toggle]);
  const onPressCountry = useCallback((id: string) => router.push(`/country/${id}`), []);

  const nearbyCities = useNearbyCities();

  return (
    <View style={styles.fill}>
      <WorldMap
        mode={mode}
        visitedCities={visitedCities}
        nearbyCities={nearbyCities.cities}
        onPressCountry={onPressCountry}
        onPressCity={onPressCity}
        onViewportChange={nearbyCities.onViewportChange}
      />

      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.switch, { backgroundColor: colors.labelHalo }]}>
          <ModeButton
            label="Countries"
            active={mode === 'countries'}
            colors={colors}
            onPress={() => setMode('countries')}
          />
          <ModeButton
            label="Cities"
            active={mode === 'cities'}
            colors={colors}
            onPress={() => setMode('cities')}
          />
        </View>

        <View style={styles.underRow}>
          <View style={[styles.counter, { backgroundColor: colors.labelHalo }]}>
            <Text style={[styles.counterText, { color: colors.label }]}>
              {mode === 'countries'
                ? `${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`
                : `${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`}
            </Text>
          </View>

          {/*
            The swatch is both the control and its own preview: it shows the current
            fill, so it needs no label, and it sits next to the map it recolours
            rather than being buried in a settings screen.
          */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Change map colour"
            style={[styles.swatchButton, { backgroundColor: colors.labelHalo }]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: colors.visited, borderColor: colors.visitedBorder },
              ]}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <AccentPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

type Bounds = { north: number; south: number; east: number; west: number };

/**
 * Loads the cities inside the current viewport so they can be browsed and ticked off.
 *
 * Three guards, each for a failure this hook hit in practice:
 *
 * `onViewportChange` is stable. An unstable callback hands <Map> a new prop on every
 * render, the map settles, emits another region event, and the whole thing feeds
 * itself into a frozen app.
 *
 * Bounds updates that barely move are dropped. A map settling after a pan emits
 * several near-identical regions, and re-rendering on sub-degree jitter restarts the
 * cycle for no new information.
 *
 * Responses are sequence-checked. SQLite can resolve an earlier query after a later
 * one, which would leave the map showing cities from a region already panned away.
 */
function useNearbyCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const sequence = useRef(0);

  const onViewportChange = useCallback((next: Bounds) => {
    setBounds((prev) => {
      if (
        prev &&
        Math.abs(prev.north - next.north) < 0.02 &&
        Math.abs(prev.south - next.south) < 0.02 &&
        Math.abs(prev.east - next.east) < 0.02 &&
        Math.abs(prev.west - next.west) < 0.02
      ) {
        // Same view, as far as anyone can tell. Returning prev keeps the identity
        // and so produces no render at all.
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!bounds) return;

    // A whole-world viewport matches all 34k cities, and nothing is drawn below
    // zoom 4.5 anyway, so skip the query rather than pay for it.
    const span = Math.max(bounds.north - bounds.south, Math.abs(bounds.east - bounds.west));
    if (span > 60) {
      setCities((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const id = ++sequence.current;
    const timer = setTimeout(() => {
      citiesInBounds(bounds, 250)
        .then((rows) => {
          if (id === sequence.current) setCities(rows);
        })
        .catch((err) => console.warn('Nearby city lookup failed', err));
    }, 250);

    return () => clearTimeout(timer);
  }, [bounds]);

  return { cities, onViewportChange };
}

function ModeButton({
  label,
  active,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  colors: MapColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.switchButton, active && { backgroundColor: colors.visited }]}
    >
      <Text
        style={[
          styles.switchLabel,
          { color: active ? colors.labelHalo : colors.label },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    marginTop: 8,
    // A hard shadow rather than a soft one: the control sits on a busy, unpredictable
    // background and needs to separate from it at every latitude.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  switchButton: { paddingVertical: 8, paddingHorizontal: 22, borderRadius: 999 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  underRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatchButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  counter: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    opacity: 0.95,
  },
  counterText: { fontSize: 13, fontWeight: '600' },
});
