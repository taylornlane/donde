import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Platform, Text, type ColorValue } from 'react-native';

/**
 * Four tabs, in the order they matter: the map you came to look at, the search you
 * use to fill it in, the numbers it produces, and the badges that reward them.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Map', tabBarIcon: icon('map', '🗺') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Add', tabBarIcon: icon('magnifyingglass', '🔍') }}
      />
      <Tabs.Screen
        name="lists"
        options={{ title: 'Lists', tabBarIcon: icon('checklist', '✓') }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: icon('chart.bar.fill', '📊') }}
      />
      <Tabs.Screen
        name="badges"
        options={{ title: 'Badges', tabBarIcon: icon('rosette', '🏅') }}
      />
    </Tabs>
  );
}

/** SF Symbols on iOS, emoji elsewhere — avoids pulling in an icon font for four glyphs. */
function icon(symbol: string, fallback: string) {
  return ({ color, size }: { color: ColorValue; size: number }) =>
    Platform.OS === 'ios' ? (
      <SymbolView name={symbol as never} size={size} tintColor={color as string} />
    ) : (
      <Text style={{ fontSize: size - 2 }}>{fallback}</Text>
    );
}
