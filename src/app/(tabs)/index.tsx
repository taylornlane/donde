import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPalette, type MapColors } from '@/constants/palette';
import { useCatalogue } from '@/lib/catalogue';
import { WorldMap, type MapMode } from '@/map/WorldMap';
import { useVisitCount } from '@/stores/visits';

/**
 * The home screen: one map, two lenses, switched by the segmented control that sits
 * over it. The counter beneath the switch is doing real work — it is the number the
 * user opens the app to see, so it stays on screen rather than living in Stats.
 */
export default function MapScreen() {
  const [mode, setMode] = useState<MapMode>('countries');
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = MapPalette[scheme];

  const visitedCities = useCatalogue((s) => s.visitedCities);
  const countryCount = useVisitCount('country');
  const cityCount = useVisitCount('city');

  return (
    <View style={styles.fill}>
      <WorldMap
        mode={mode}
        visitedCities={visitedCities}
        onPressCountry={(id) => router.push(`/country/${id}`)}
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

        <View style={[styles.counter, { backgroundColor: colors.labelHalo }]}>
          <Text style={[styles.counterText, { color: colors.label }]}>
            {mode === 'countries'
              ? `${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`
              : `${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
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
  counter: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    opacity: 0.95,
  },
  counterText: { fontSize: 13, fontWeight: '600' },
});
