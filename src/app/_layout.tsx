import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import migrations from '@/../drizzle/migrations';
import { db } from '@/db';
import { bootstrap } from '@/lib/catalogue';

SplashScreen.preventAutoHideAsync();

/**
 * Nothing renders until both databases are ready.
 *
 * That is a deliberate trade. A travel tracker that flashes an empty map and then
 * pops 80 countries into existence a beat later looks broken every single launch;
 * holding the splash for the extra few hundred milliseconds costs nothing and the
 * app appears fully-formed. The first launch is slower — it copies a 9MB catalogue
 * out of the bundle — but that happens exactly once per install.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<Error | null>(null);

  useEffect(() => {
    if (!migrated) return;
    bootstrap()
      .then(() => setBooted(true))
      .catch(setBootError);
  }, [migrated]);

  useEffect(() => {
    if (booted || bootError || migrationError) SplashScreen.hideAsync();
  }, [booted, bootError, migrationError]);

  const error = migrationError ?? bootError;
  if (error) return <BootFailure error={error} />;

  if (!booted) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/*
          Without an explicit back title these inherit the route name and the arrow
          reads "(tabs)". Name the place you came from instead.
        */}
        <Stack.Screen
          name="country/[id]"
          options={{ presentation: 'card', headerShown: true, headerBackTitle: 'Map' }}
        />
        <Stack.Screen
          name="list/[id]"
          options={{ presentation: 'card', headerShown: true, headerBackTitle: 'All Lists' }}
        />
      </Stack>
    </ThemeProvider>
  );
}

/**
 * A boot failure means a corrupt or missing catalogue, which the user cannot fix
 * from inside the app. Say so plainly rather than showing an empty map that looks
 * like they have been nowhere.
 */
function BootFailure({ error }: { error: Error }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.errorTitle}>dónde couldn’t start</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
      <Text style={styles.errorHint}>
        Reinstalling the app will rebuild the place catalogue. Your saved visits are
        stored separately and will not be lost.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  errorTitle: { fontSize: 20, fontWeight: '600' },
  errorBody: { fontSize: 14, opacity: 0.8, textAlign: 'center' },
  errorHint: { fontSize: 13, opacity: 0.6, textAlign: 'center', marginTop: 8 },
});
