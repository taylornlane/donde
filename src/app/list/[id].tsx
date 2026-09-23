import { FlashList } from '@shopify/flash-list';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MapColors } from '@/constants/palette';
import type { PlaceKind } from '@/db/schema';
import { useMapColors } from '@/hooks/use-map-colors';
import { usePlaceSearch, useResolvedPlaces, type PlaceInfo } from '@/lib/places';
import { useLists } from '@/stores/lists';
import { useVisits } from '@/stores/visits';

const KINDS: { key: PlaceKind; label: string }[] = [
  { key: 'country', label: 'Countries' },
  { key: 'city', label: 'Cities' },
  { key: 'park', label: 'Parks' },
  { key: 'landmark', label: 'Wonders' },
];

/**
 * One checklist.
 *
 * Two modes in one screen: the list itself, and a search for adding to it. Keeping
 * them together means adding five places to a trip is five taps in one place rather
 * than five round trips through a picker.
 */
export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = Number(id);
  const colors = useMapColors();

  const list = useLists((s) => s.lists.find((l) => l.id === listId));
  const items = useLists((s) => s.itemsByList.get(listId) ?? []);
  const removePlace = useLists((s) => s.removePlace);
  const deleteList = useLists((s) => s.deleteList);

  const [adding, setAdding] = useState(false);

  const resolved = useResolvedPlaces(items);
  const byKey = useVisits((s) => s.byKey);

  if (!list) return null;

  const done = resolved.filter((p) => byKey.has(`${p.kind}:${p.id}`)).length;

  const confirmDelete = () =>
    Alert.alert(`Delete “${list.name}”?`, 'The places on it stay in your visits.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteList(listId);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: `${list.emoji}  ${list.name}`,
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={8}>
              <Text style={{ color: colors.visited, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.fill}>
        <View style={styles.topBar}>
          <Text style={[styles.progress, { color: colors.label }]}>
            {items.length === 0 ? 'Nothing on this list yet' : `${done} of ${items.length} visited`}
          </Text>
          <Pressable
            onPress={() => setAdding((a) => !a)}
            style={[
              styles.addToggle,
              { backgroundColor: adding ? colors.unvisited : colors.visited },
            ]}
          >
            <Text style={{ color: adding ? colors.label : '#fff', fontWeight: '700', fontSize: 14 }}>
              {adding ? 'Done' : 'Add places'}
            </Text>
          </Pressable>
        </View>

        {adding ? (
          <AddPlaces listId={listId} colors={colors} />
        ) : (
          <FlashList
            data={resolved}
            keyExtractor={(p) => `${p.kind}:${p.id}`}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.label }]}>
                Tap “Add places” to start filling this in.
              </Text>
            }
            renderItem={({ item }) => (
              <ItemRow
                place={item}
                colors={colors}
                onRemove={() => removePlace(listId, item.kind, item.id)}
              />
            )}
          />
        )}
      </View>
    </>
  );
}

/**
 * A row is ticked when the place has been visited — tapping the circle records the
 * visit rather than checking a separate box, so the list and the map never disagree
 * about where you've been.
 */
function ItemRow({
  place,
  colors,
  onRemove,
}: {
  place: PlaceInfo;
  colors: MapColors;
  onRemove: () => void;
}) {
  const visited = useVisits((s) => s.byKey.has(`${place.kind}:${place.id}`));
  const toggle = useVisits((s) => s.toggle);

  return (
    <Pressable
      onPress={() => toggle(place.kind, place.id)}
      onLongPress={onRemove}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visited }}
      accessibilityHint="Long press to remove from this list"
      style={styles.row}
    >
      <View
        style={[
          styles.check,
          {
            borderColor: visited ? colors.visited : colors.unvisitedBorder,
            backgroundColor: visited ? colors.visited : 'transparent',
          },
        ]}
      >
        {visited && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowTitle,
            { color: colors.label },
            visited && styles.rowTitleDone,
          ]}
          numberOfLines={1}
        >
          {place.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: colors.label }]} numberOfLines={1}>
          {place.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function AddPlaces({ listId, colors }: { listId: number; colors: MapColors }) {
  const [kind, setKind] = useState<PlaceKind>('city');
  const [query, setQuery] = useState('');
  const results = usePlaceSearch(kind, query);

  return (
    <View style={styles.fill}>
      <View style={styles.addHeader}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${kind === 'landmark' ? 'wonders' : `${kind}s`}`}
          placeholderTextColor={colors.unvisitedBorder}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[styles.input, { color: colors.label, backgroundColor: colors.unvisited }]}
        />
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={[styles.kindChip, kind === k.key && { backgroundColor: colors.visited }]}
            >
              <Text
                style={[styles.kindLabel, { color: kind === k.key ? '#fff' : colors.label }]}
              >
                {k.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlashList
        data={results}
        keyExtractor={(p) => `${p.kind}:${p.id}`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.label }]}>
            {kind === 'city' && !query.trim()
              ? 'Search for a city to add it.'
              : 'Nothing matches that.'}
          </Text>
        }
        renderItem={({ item }) => <AddRow listId={listId} place={item} colors={colors} />}
      />
    </View>
  );
}

function AddRow({
  listId,
  place,
  colors,
}: {
  listId: number;
  place: PlaceInfo;
  colors: MapColors;
}) {
  const onList = useLists((s) =>
    (s.itemsByList.get(listId) ?? []).some(
      (i) => i.kind === place.kind && i.placeId === place.id
    )
  );
  const addPlace = useLists((s) => s.addPlace);
  const removePlace = useLists((s) => s.removePlace);

  return (
    <Pressable
      onPress={() =>
        onList
          ? removePlace(listId, place.kind, place.id)
          : addPlace(listId, place.kind, place.id)
      }
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.label }]} numberOfLines={1}>
          {place.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: colors.label }]} numberOfLines={1}>
          {place.subtitle}
        </Text>
      </View>
      <Text style={{ color: onList ? colors.visited : colors.unvisitedBorder, fontSize: 22 }}>
        {onList ? '−' : '+'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  progress: { fontSize: 13, opacity: 0.65 },
  addToggle: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999 },
  addHeader: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  kindRow: { flexDirection: 'row', gap: 6 },
  kindChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  kindLabel: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowTitleDone: { opacity: 0.55 },
  rowSubtitle: { fontSize: 12, opacity: 0.6 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 48, paddingHorizontal: 40, opacity: 0.6 },
});
