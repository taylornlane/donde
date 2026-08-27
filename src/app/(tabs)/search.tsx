import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPalette, type MapColors } from '@/constants/palette';
import { searchCities, type City, type Country } from '@/db/reference';
import type { PlaceKind } from '@/db/schema';
import { useCatalogue } from '@/lib/catalogue';
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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = MapPalette[scheme];

  const { countries, parks, landmarks } = useCatalogue();
  const cityResults = useCitySearch(tab === 'cities' ? query : '');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (name: string) => !q || name.toLowerCase().includes(q);

    switch (tab) {
      case 'countries':
        return countries
          .filter((c) => match(c.name))
          .map((c) => ({
            id: c.id,
            kind: 'country' as PlaceKind,
            title: `${c.emoji}  ${c.name}`,
            subtitle: `${c.continent}${c.capital ? ` · ${c.capital}` : ''}`,
          }));
      case 'cities':
        return cityResults.map((c) => ({
          id: c.id,
          kind: 'city' as PlaceKind,
          title: c.name,
          subtitle: subtitleForCity(c, countries),
        }));
      case 'parks':
        return parks
          .filter((p) => match(p.full_name))
          .map((p) => ({
            id: p.id,
            kind: 'park' as PlaceKind,
            title: p.name,
            subtitle: `${p.designation}${p.states ? ` · ${p.states}` : ''}`,
          }));
      case 'wonders':
        return landmarks
          .filter((l) => match(l.name))
          .map((l) => ({
            id: l.id,
            kind: 'landmark' as PlaceKind,
            title: l.name,
            subtitle: l.kind.replace('wonder_', '').replace('_', ' '),
          }));
    }
  }, [tab, query, countries, parks, landmarks, cityResults]);

  const emptyMessage =
    tab === 'cities' && !query.trim()
      ? 'Search for a city — try a country’s capital, or somewhere you had to look up.'
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
              <Text
                style={[
                  styles.tabLabel,
                  { color: tab === t.key ? '#fff' : colors.label },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
}: {
  id: string;
  kind: PlaceKind;
  title: string;
  subtitle: string;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = MapPalette[scheme];
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

/**
 * Debounced FTS lookup. 180ms is short enough to feel live while still collapsing a
 * fast typist's keystrokes into one query rather than eight.
 */
function useCitySearch(query: string): City[] {
  const [results, setResults] = useState<City[]>([]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchCities(term)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch((err) => console.warn('City search failed', err));
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return results;
}

/** "Kyoto · Japan · rarity 34" — the country matters most for disambiguation. */
function subtitleForCity(city: City, countries: Country[]): string {
  const country = countries.find((c) => c.id === city.country_id);
  const parts = [country ? `${country.emoji} ${country.name}` : city.country_id];
  if (city.admin1_name) parts.push(city.admin1_name);
  parts.push(`rarity ${city.rarity}`);
  return parts.join(' · ');
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
