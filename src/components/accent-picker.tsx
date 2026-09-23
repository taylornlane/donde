import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { ACCENTS, MapPalette } from '../constants/palette';
import { useMapColors } from '../hooks/use-map-colors';
import { useSettings } from '../stores/settings';

/**
 * Picks the colour visited places are painted in.
 *
 * Presented as swatches of the actual fill rather than named options, because the
 * only useful question is what it looks like on the map — and the map is visible
 * behind the sheet while you choose, so the change is previewed against real
 * geography rather than a colour chip.
 */
export function AccentPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = MapPalette[scheme];
  const colors = useMapColors();

  const accentId = useSettings((s) => s.accentId);
  const setAccent = useSettings((s) => s.setAccent);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tapping the map behind the sheet dismisses it — the sheet is a light
          touch on top of the thing it edits, not a screen you navigate into. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close colour picker">
        <Pressable
          style={[styles.sheet, { backgroundColor: base.labelHalo }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: base.label }]}>Map colour</Text>

          <View style={styles.grid}>
            {ACCENTS.map((accent) => {
              const swatch = accent[scheme];
              const selected = accent.id === accentId;
              return (
                <Pressable
                  key={accent.id}
                  onPress={() => {
                    setAccent(accent.id);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={accent.name}
                  style={styles.option}
                >
                  <View
                    style={[
                      styles.ring,
                      { borderColor: selected ? swatch.fill : 'transparent' },
                    ]}
                  >
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: swatch.fill, borderColor: swatch.border },
                      ]}
                    />
                  </View>
                  <Text style={[styles.name, { color: base.label }]}>{accent.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={styles.done}>
            <Text style={[styles.doneLabel, { color: colors.visited }]}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 16,
  },
  title: { fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'flex-start' },
  option: { alignItems: 'center', gap: 5, width: 64 },
  ring: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  name: { fontSize: 11, opacity: 0.7 },
  done: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 8 },
  doneLabel: { fontSize: 16, fontWeight: '700' },
});
