import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapColors } from '@/constants/palette';
import { useMapColors } from '@/hooks/use-map-colors';
import { useCatalogue } from '@/lib/catalogue';
import {
  byContinent,
  countryProgress,
  explorerScore,
  explorerTier,
  landAreaProgress,
  parkProgress,
  populationReach,
  wonderProgress,
  type Percentage,
} from '@/lib/stats';
import { busiestYear, byMonth, byYear } from '@/lib/dates';
import { bandDistribution, comparisonLine, rarityBand } from '@/lib/rarity';
import { useVisitedIds, useVisits } from '@/stores/visits';

export default function StatsScreen() {
  const colors = useMapColors();

  const { countries, parks, landmarks, visitedCities } = useCatalogue();
  const visitedCountries = useVisitedIds('country');
  const visitedParks = useVisitedIds('park');
  const visitedLandmarks = useVisitedIds('landmark');

  const progress = countryProgress(countries, visitedCountries);
  const land = landAreaProgress(countries, visitedCountries);
  const people = populationReach(countries, visitedCountries);
  const continents = byContinent(countries, visitedCountries);
  const score = explorerScore(visitedCities);
  const wonders = wonderProgress(landmarks, visitedLandmarks);
  const npsProgress = parkProgress(parks, visitedParks);

  // Every visit row, not just ids — the year breakdown needs the dates on them.
  const allVisits = useVisits((s) => s.byKey);
  const { years, undated } = byYear([...allVisits.values()]);
  const months = byMonth([...allVisits.values()]);
  const busiest = busiestYear(years);
  const peakMonth = Math.max(...months);

  const bands = bandDistribution(visitedCities);
  const comparison = comparisonLine(visitedCities);

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content}>
        <Hero
          value={`${progress.sovereign.done}`}
          of={`of ${progress.sovereign.total}`}
          caption="countries"
          pct={progress.sovereign.pct}
          colors={colors}
        />

        <Section title="The world" colors={colors}>
          <Stat label="Land area covered" value={fmtPct(land.pct)} colors={colors} />
          <Stat
            label="Share of humanity"
            value={fmtPct(people.pct)}
            hint="people living in countries you've visited"
            colors={colors}
          />
          <Stat
            label="Territories & dependencies"
            value={`${progress.territories.done} / ${progress.territories.total}`}
            colors={colors}
          />
          <Stat label="Cities" value={`${visitedCities.length}`} colors={colors} />
        </Section>

        <Section title="How you travel" colors={colors}>
          <Stat
            label={explorerTier(score.average)}
            value={`${score.average}`}
            hint="your average rarity — 100 is the least-visited place we know of"
            colors={colors}
          />

          {comparison && (
            <Text style={[styles.hint, { color: colors.label }]}>{comparison}</Text>
          )}

          {/* The distribution is the honest version of a single score: it shows
              whether an average of 45 means everywhere is middling, or that half
              your trips are Paris and half are the Sahel. */}
          {visitedCities.length > 0 &&
            bands.map(({ band, count, fraction }) => (
              <Bar
                key={band.key}
                label={band.label}
                value={`${count}`}
                fraction={fraction}
                colors={colors}
              />
            ))}

          {score.rarest && (
            <Stat
              label="Rarest place you've been"
              value={score.rarest.name}
              hint={rarityBand(score.rarest.rarity).blurb}
              colors={colors}
            />
          )}
        </Section>

        <Section title="Continents" colors={colors}>
          {continents.map((c) => (
            <Bar
              key={c.continent}
              label={c.continent}
              value={`${c.done}/${c.total}`}
              fraction={c.pct / 100}
              colors={colors}
            />
          ))}
        </Section>

        <Section title="United States parks" colors={colors}>
          {npsProgress.allUnits.total === 0 ? (
            <Text style={[styles.hint, { color: colors.label }]}>
              Park data isn’t built yet — add an NPS API key and rerun the pipeline.
            </Text>
          ) : (
            <>
              <Bar
                label="National Parks"
                value={fmtOf(npsProgress.nationalParks)}
                fraction={npsProgress.nationalParks.pct / 100}
                colors={colors}
              />
              <Bar
                label="National Monuments"
                value={fmtOf(npsProgress.monuments)}
                fraction={npsProgress.monuments.pct / 100}
                colors={colors}
              />
              <Bar
                label="All NPS units"
                value={fmtOf(npsProgress.allUnits)}
                fraction={npsProgress.allUnits.pct / 100}
                colors={colors}
              />
            </>
          )}
        </Section>

        <Section title="By year" colors={colors}>
          {years.length === 0 ? (
            <Text style={[styles.hint, { color: colors.label }]}>
              Add dates to your visits and they’ll break down by year here. Tap the
              “+ date” beside anywhere you’ve been.
            </Text>
          ) : (
            <>
              {busiest && (
                <Stat
                  label="Busiest year"
                  value={`${busiest.year}`}
                  hint={`${busiest.total} places`}
                  colors={colors}
                />
              )}
              {years.map((y) => (
                <Bar
                  key={y.year}
                  label={`${y.year}`}
                  value={`${y.total}`}
                  fraction={busiest ? y.total / busiest.total : 0}
                  colors={colors}
                />
              ))}
              {undated > 0 && (
                <Text style={[styles.hint, { color: colors.label }]}>
                  {undated} {undated === 1 ? 'visit has' : 'visits have'} no date yet.
                </Text>
              )}
            </>
          )}
        </Section>

        {peakMonth > 0 && (
          <Section title="When you travel" colors={colors}>
            <View style={styles.monthRow}>
              {months.map((count, i) => (
                <View key={i} style={styles.monthCol}>
                  <View style={styles.monthBarTrack}>
                    <View
                      style={[
                        styles.monthBarFill,
                        {
                          backgroundColor: count > 0 ? colors.visited : 'transparent',
                          height: `${(count / peakMonth) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.monthLabel, { color: colors.label }]}>
                    {MONTH_INITIALS[i]}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Wonders" colors={colors}>
          <Bar label="New7Wonders" value={fmtOf(wonders.modern)} fraction={wonders.modern.pct / 100} colors={colors} />
          <Bar label="Of Nature" value={fmtOf(wonders.natural)} fraction={wonders.natural.pct / 100} colors={colors} />
          <Bar label="Ancient" value={fmtOf(wonders.ancient)} fraction={wonders.ancient.pct / 100} colors={colors} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Hero({
  value,
  of,
  caption,
  pct,
  colors,
}: {
  value: string;
  of: string;
  caption: string;
  pct: number;
  colors: MapColors;
}) {
  return (
    <View style={styles.hero}>
      <Text style={[styles.heroValue, { color: colors.visited }]}>{value}</Text>
      <Text style={[styles.heroOf, { color: colors.label }]}>
        {of} {caption}
      </Text>
      <Text style={[styles.heroPct, { color: colors.label }]}>{fmtPct(pct)} of the world</Text>
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: MapColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.label }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.unvisited }]}>{children}</View>
    </View>
  );
}

function Stat({
  label,
  value,
  hint,
  colors,
}: {
  label: string;
  value: string;
  hint?: string;
  colors: MapColors;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statText}>
        <Text style={[styles.statLabel, { color: colors.label }]}>{label}</Text>
        {hint && <Text style={[styles.hint, { color: colors.label }]}>{hint}</Text>}
      </View>
      <Text style={[styles.statValue, { color: colors.visited }]}>{value}</Text>
    </View>
  );
}

function Bar({
  label,
  value,
  fraction,
  colors,
}: {
  label: string;
  value: string;
  fraction: number;
  colors: MapColors;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.barHeader}>
        <Text style={[styles.statLabel, { color: colors.label }]}>{label}</Text>
        <Text style={[styles.barValue, { color: colors.label }]}>{value}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.unvisitedBorder }]}>
        <View
          style={[
            styles.trackFill,
            {
              backgroundColor: colors.visited,
              // A hairline of colour at 0% reads as "nothing yet" rather than as a
              // rendering bug, and gives the bar somewhere visible to grow from.
              width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const fmtPct = (n: number) => (n >= 10 || n === 0 ? `${Math.round(n)}%` : `${n.toFixed(1)}%`);
const fmtOf = (p: Percentage) => `${p.done}/${p.total}`;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, gap: 2 },
  heroValue: { fontSize: 64, fontWeight: '700', lineHeight: 68 },
  heroOf: { fontSize: 16, opacity: 0.7 },
  heroPct: { fontSize: 13, opacity: 0.5, marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: 0.5 },
  card: { borderRadius: 14, padding: 14, gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statText: { flex: 1, gap: 2 },
  statLabel: { fontSize: 15, fontWeight: '500' },
  statValue: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, opacity: 0.55 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', height: 90, gap: 4 },
  monthCol: { flex: 1, alignItems: 'center', gap: 5 },
  // Bars grow from the bottom, so the column is a fixed-height box filled upward.
  monthBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  monthBarFill: { width: '100%', borderRadius: 3, minHeight: 2 },
  monthLabel: { fontSize: 10, opacity: 0.55 },
  bar: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barValue: { fontSize: 13, opacity: 0.6, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
});
