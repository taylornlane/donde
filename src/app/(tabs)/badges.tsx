import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapColors } from '@/constants/palette';
import { useMapColors } from '@/hooks/use-map-colors';
import { evaluateBadges, type BadgeState } from '@/lib/badges';
import { useCatalogue } from '@/lib/catalogue';
import { useVisitedIds } from '@/stores/visits';

const GROUP_TITLES: Record<BadgeState['group'], string> = {
  milestone: 'Milestones',
  geography: 'Geography',
  rarity: 'Off the beaten path',
  collection: 'Collections',
};

export default function BadgesScreen() {
  const colors = useMapColors();

  const { countries, parks, landmarks, visitedCities } = useCatalogue();
  const visitedCountryIds = useVisitedIds('country');
  const visitedParkIds = useVisitedIds('park');
  const visitedLandmarkIds = useVisitedIds('landmark');

  const badges = useMemo(
    () =>
      evaluateBadges({
        countries,
        parks,
        landmarks,
        visitedCountryIds,
        visitedCities,
        visitedParkIds,
        visitedLandmarkIds,
      }),
    [countries, parks, landmarks, visitedCountryIds, visitedCities, visitedParkIds, visitedLandmarkIds]
  );

  const earned = badges.filter((b) => b.earned).length;

  const groups = useMemo(() => {
    const map = new Map<BadgeState['group'], BadgeState[]>();
    for (const b of badges) map.set(b.group, [...(map.get(b.group) ?? []), b]);
    return [...map.entries()];
  }, [badges]);

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.summary, { color: colors.label }]}>
          <Text style={{ color: colors.visited, fontWeight: '700' }}>{earned}</Text>
          {` of ${badges.length} earned`}
        </Text>

        {groups.map(([group, items]) => (
          <View key={group} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>
              {GROUP_TITLES[group]}
            </Text>
            <View style={styles.grid}>
              {items.map((badge) => (
                <BadgeTile key={badge.code} badge={badge} colors={colors} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A locked badge shows its progress rather than hiding behind a silhouette. Knowing
 * you are three countries from Century Club is motivating; a grey square is not.
 */
function BadgeTile({
  badge,
  colors,
}: {
  badge: BadgeState;
  colors: MapColors;
}) {
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.unvisited,
          borderColor: badge.earned ? colors.visited : 'transparent',
        },
      ]}
    >
      <Text style={[styles.emoji, !badge.earned && styles.emojiLocked]}>{badge.emoji}</Text>
      <Text style={[styles.tileName, { color: colors.label }]} numberOfLines={2}>
        {badge.name}
      </Text>
      <Text style={[styles.tileDesc, { color: colors.label }]} numberOfLines={3}>
        {badge.description}
      </Text>

      {badge.earned ? (
        <Text style={[styles.earned, { color: colors.visited }]}>Earned</Text>
      ) : (
        <>
          <View style={[styles.track, { backgroundColor: colors.unvisitedBorder }]}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: colors.visited, width: `${badge.fraction * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.progress, { color: colors.label }]}>
            {badge.target > 0 ? `${badge.current} / ${badge.target}` : 'Data not loaded'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 40 },
  summary: { fontSize: 17, textAlign: 'center', paddingVertical: 8 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    gap: 5,
    minHeight: 150,
  },
  emoji: { fontSize: 30 },
  emojiLocked: { opacity: 0.35 },
  tileName: { fontSize: 14, fontWeight: '700' },
  tileDesc: { fontSize: 11, opacity: 0.6, flex: 1 },
  earned: { fontSize: 12, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  progress: { fontSize: 11, opacity: 0.6, fontVariant: ['tabular-nums'] },
});
