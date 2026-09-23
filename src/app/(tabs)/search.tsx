import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapColors } from '@/constants/palette';
import { useMapColors } from '@/hooks/use-map-colors';
import { RarityMeter } from '@/components/rarity-meter';
import type { PlaceKind } from '@/db/schema';
import { usePlaceSearch, type CitySort } from '@/lib/places';
import { useVisits } from '@/stores/visits';

type Tab = 'countries' | 'cities' | 'parks' | 'wonders';

const TABS: { key: Tab; label: string; kind: PlaceKind }[] = [
  { key: 'countries', label: 'Countries', kind: 'country' },
  { key: 'cities', label: 'Cities', kind: 'city' },
  { key: 'parks', label: 'Parks', kind: 'park' },
  { key: 'wonders', label: 'Wonders', kind: 'landmark' },
];

/**
 * Where the map actually gets filled in.
 *
 * Countries, parks and wonders are short enough to hold in memory and filter as you
 * type. Cities are not — 34,124 of them stay in SQLite and come back through FTS5,
 * which is why that one branch is async and debounced while the others are instant.
 */
export default function SearchScreen() {
  const [tab, setTab] = useState<Tab>('countries');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CitySort>('relevance');
  const colors = useMapColors();

  const kind = TABS.find((t) => t.key === tab)!.kind;
  const rows = usePlaceSearch(kind, query, sort);

  const emptyMessage =
    tab === 'cities' && !query.trim() && sort === 'relevance'
      ? 'Search for a city — or switch to Rarest to browse the obscure end of the map.'
      : 'Nothing matches that.';

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <View style={styles.header}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${tab}`}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[styles.input, { color: colors.label, backgroundColor: colors.unvisited }]}
          placeholderTextColor={colors.unvisitedBorder}
        />

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && { backgroundColor: colors.visited }]}
            >
              <Text style={[styles.tabLabel, { color: tab === t.key ? '#fff' : colors.label }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sorting by rarity only means anything for cities — countries, parks and
            wonders are short, fixed lists where the order is not the interesting part. */}
        {tab === 'cities' && (
          <View style={styles.sortRow}>
            {(['relevance', 'rarest'] as CitySort[]).map((option) => (
              <Pressable key={option} onPress={() => setSort(option)} hitSlop={6}>
                <Text
                  style={[
                    styles.sortLabel,
                    {
                      color: sort === option ? colors.visited : colors.label,
                      opacity: sort === option ? 1 : 0.5,
                    },
                  ]}
                >
                  {option === 'relevance' ? 'Best match' : 'Rarest first'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <FlashList
        data={rows}
        keyExtractor={(r) => `${r.kind}:${r.id}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ResultRow
            id={item.id}
            kind={item.kind}
            title={item.title}
            subtitle={item.subtitle}
            rarity={item.rarity}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.label }]}>{emptyMessage}</Text>
        }
      />
    </SafeAreaView>
  );
}

/**
 * One tappable row. Subscribed to its own visited state only, so ticking Japan does
 * not re-render the other 251 countries.
 */
function ResultRow({
  id,
  kind,
  title,
  subtitle,
  rarity,
}: {
  id: string;
  kind: PlaceKind;
  title: string;
  subtitle: string;
  rarity?: number;
}) {
  const colors = useMapColors();
  const visited = useVisits((s) => s.byKey.has(`${kind}:${id}`));
  const toggle = useVisits((s) => s.toggle);

  return (
    <Pressable
      onPress={() => toggle(kind, id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visited }}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.label }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: colors.label }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {rarity !== undefined && <RarityMeter rarity={rarity} colors={colors} />}
      </View>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  tabs: { flexDirection: 'row', gap: 6 },
  sortRow: { flexDirection: 'row', gap: 16, paddingTop: 2 },
  sortLabel: { fontSize: 13, fontWeight: '600' },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
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
