import { StyleSheet, Text, View } from 'react-native';

import type { MapColors } from '../constants/palette';
import { rarityBand } from '../lib/rarity';

/**
 * Four segments, filled to the band. A meter rather than a number because the
 * question people actually have is comparative — "is this rarer than the last one"
 * — and four filled bars answer that at a glance where "rarity 63" does not.
 *
 * The raw percentile stays available as the accessibility label, so the precise
 * value is still reachable without putting a number nobody asked for on every row.
 */
export function RarityMeter({
  rarity,
  colors,
  showLabel = true,
}: {
  rarity: number;
  colors: MapColors;
  showLabel?: boolean;
}) {
  const band = rarityBand(rarity);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${band.label}, rarity ${rarity} of 100`}
    >
      <View style={styles.segments}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.segment,
              {
                backgroundColor:
                  step <= band.steps ? colors.visited : colors.unvisitedBorder,
                // Later segments read as "further out" — a subtle ramp so a full
                // meter looks different from a single bar even at a glance.
                opacity: step <= band.steps ? 0.5 + step * 0.125 : 0.4,
              },
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: colors.label }]}>{band.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segments: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  // Ascending heights, so the shape itself encodes the scale.
  segment: { width: 3, height: 10, borderRadius: 1.5 },
  label: { fontSize: 11, opacity: 0.7, fontWeight: '600' },
});
