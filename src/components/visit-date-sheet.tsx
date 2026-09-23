import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MapColors } from '../constants/palette';
import type { PlaceKind } from '../db/schema';
import { useMapColors } from '../hooks/use-map-colors';
import { formatVisitDate } from '../lib/dates';
import { useVisits } from '../stores/visits';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Picks when you were somewhere, at whatever precision you actually remember.
 *
 * Year first and alone is a complete answer — you commit by picking one, and the
 * month row below is optional refinement. Most date pickers make you produce a day
 * you don't know; this one treats "2019" as finished, which is the difference
 * between people filling it in and people skipping it.
 */
export function VisitDateSheet({
  visible,
  kind,
  placeId,
  placeName,
  onClose,
}: {
  visible: boolean;
  kind: PlaceKind;
  placeId: string;
  placeName: string;
  onClose: () => void;
}) {
  const colors = useMapColors();
  const current = useVisits((s) => s.byKey.get(`${kind}:${placeId}`)?.visitedOn ?? null);
  const setVisitedOn = useVisits((s) => s.setVisitedOn);

  const [year, setYear] = useState<number | null>(current ? Number(current.slice(0, 4)) : null);
  const [month, setMonth] = useState<number | null>(
    current && current.length >= 7 ? Number(current.slice(5, 7)) : null
  );

  const thisYear = new Date().getFullYear();
  // Sixty years back covers a lifetime of travel without an endless scroll.
  const years = Array.from({ length: 61 }, (_, i) => thisYear - i);

  const save = async (y: number | null, m: number | null) => {
    if (y === null) {
      await setVisitedOn(kind, placeId, null);
      return;
    }
    await setVisitedOn(kind, placeId, m ? `${y}-${String(m).padStart(2, '0')}` : `${y}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.labelHalo }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.label }]} numberOfLines={1}>
                {placeName}
              </Text>
              <Text style={[styles.subtitle, { color: colors.label }]}>
                {year ? formatVisitDate(month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`) : 'When were you there?'}
              </Text>
            </View>
            {year !== null && (
              <Pressable
                onPress={async () => {
                  setYear(null);
                  setMonth(null);
                  await save(null, null);
                }}
              >
                <Text style={[styles.clear, { color: colors.label }]}>Clear</Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.legend, { color: colors.label }]}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {years.map((y) => (
              <Pressable
                key={y}
                onPress={async () => {
                  setYear(y);
                  await save(y, month);
                }}
                style={[
                  styles.chip,
                  { backgroundColor: y === year ? colors.visited : colors.unvisited },
                ]}
              >
                <Text style={[styles.chipLabel, { color: y === year ? '#fff' : colors.label }]}>
                  {y}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.legend, { color: colors.label }]}>
            Month <Text style={styles.optional}>— optional</Text>
          </Text>
          <View style={styles.monthGrid}>
            {MONTHS.map((label, i) => {
              const m = i + 1;
              const selected = m === month;
              return (
                <Pressable
                  key={label}
                  // Tapping the selected month clears it, so you can go back to
                  // "just 2019" without clearing the year and starting over.
                  onPress={async () => {
                    const next = selected ? null : m;
                    setMonth(next);
                    if (year !== null) await save(year, next);
                  }}
                  disabled={year === null}
                  style={[
                    styles.month,
                    {
                      backgroundColor: selected ? colors.visited : colors.unvisited,
                      opacity: year === null ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: selected ? '#fff' : colors.label }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={[styles.done, { backgroundColor: colors.visited }]}>
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The small tappable chip that shows a visit's date, or invites one. */
export function VisitDateChip({
  kind,
  placeId,
  colors,
  onPress,
}: {
  kind: PlaceKind;
  placeId: string;
  colors: MapColors;
  onPress: () => void;
}) {
  const visitedOn = useVisits((s) => s.byKey.get(`${kind}:${placeId}`)?.visitedOn ?? null);

  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.dateChip}>
      <Text
        style={[
          styles.dateChipLabel,
          { color: visitedOn ? colors.visited : colors.unvisitedBorder },
        ]}
      >
        {visitedOn ? formatVisitDate(visitedOn) : '+ date'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  clear: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  legend: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: 0.5, marginTop: 6 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { width: 62, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  done: { marginTop: 8, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  doneLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dateChip: { paddingVertical: 2, paddingHorizontal: 6 },
  dateChipLabel: { fontSize: 12, fontWeight: '600' },
});
