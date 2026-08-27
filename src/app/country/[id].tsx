import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { MapPalette, type MapColors } from '@/constants/palette';
import { citiesInCountry, type City } from '@/db/reference';
import { useCatalogue } from '@/lib/catalogue';
import { countryExploration } from '@/lib/stats';
import { useVisitedIds, useVisits } from '@/stores/visits';

/**
 * One country, and the cities in it — the "help me remember" screen.
 *
 * Cities are listed by population rather than alphabetically because recall works
 * that way: you scan for the big names you recognise, and the long tail is there for
 * when you know you went somewhere near Osaka but cannot name it.
 */
export default function CountryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = MapPalette[scheme];

  const country = useCatalogue((s) => s.countries.find((c) => c.id === id));
  const visitedCityIds = useVisitedIds('city');
  const countryVisited = useVisits((s) => s.byKey.has(`country:${id}`));
  const toggle = useVisits((s) => s.toggle);

  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // 1,000 covers every country in the catalogue except the US, China and India,
    // where the tail past a thousand cities is not what anyone is scrolling for.
    citiesInCountry(id, 1000)
      .then((rows) => !cancelled && setCities(rows))
      .catch((err) => console.warn('Failed to load cities', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!country) return null;

  const exploration = countryExploration(country, cities, visitedCityIds);

  return (
    <>
      <Stack.Screen options={{ title: country.name }} />
      <View style={styles.fill}>
        <View style={[styles.header, { backgroundColor: colors.unvisited }]}>
          <Text style={styles.flag}>{country.emoji}</Text>
          <View style={styles.headerText}>
            <Text style={[styles.pct, { color: colors.visited }]}>
              {exploration.byUrbanPopulation.pct.toFixed(1)}%
            </Text>
            <Text style={[styles.hint, { color: colors.label }]}>
              of {country.name}’s urban population — {exploration.visitedCities.length} of{' '}
              {cities.length} cities
            </Text>
          </View>
          <Pressable
            onPress={() => toggle('country', country.id)}
            style={[
              styles.mark,
              {
                backgroundColor: countryVisited ? colors.visited : 'transparent',
                borderColor: countryVisited ? colors.visited : colors.unvisitedBorder,
              },
            ]}
          >
            <Text style={{ color: countryVisited ? '#fff' : colors.label, fontWeight: '600' }}>
              {countryVisited ? 'Been' : 'Mark'}
            </Text>
          </Pressable>
        </View>

        <FlashList
          data={cities}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CityRow city={item} colors={colors} />}
        />
      </View>
    </>
  );
}

function CityRow({ city, colors }: { city: City; colors: MapColors }) {
  const visited = useVisits((s) => s.byKey.has(`city:${city.id}`));
  const toggle = useVisits((s) => s.toggle);

  return (
    <Pressable
      onPress={() => toggle('city', city.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visited }}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.label }]}>{city.name}</Text>
        <Text style={[styles.hint, { color: colors.label }]}>
          {city.admin1_name ? `${city.admin1_name} · ` : ''}
          {city.population.toLocaleString()} · rarity {city.rarity}
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, margin: 12, borderRadius: 14 },
  flag: { fontSize: 40 },
  headerText: { flex: 1, gap: 2 },
  pct: { fontSize: 26, fontWeight: '700' },
  hint: { fontSize: 12, opacity: 0.6 },
  mark: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
