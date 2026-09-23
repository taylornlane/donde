import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapColors } from '@/constants/palette';
import { useMapColors } from '@/hooks/use-map-colors';
import { useLists } from '@/stores/lists';
import { useVisits } from '@/stores/visits';

/** A small spread rather than a full picker — enough to tell lists apart at a glance. */
const EMOJI_CHOICES = ['📍', '✈️', '🏔️', '🏝️', '🎒', '🍜', '🏛️', '🚂', '🌋', '⛩️', '🗿', '🌍'];

export default function ListsScreen() {
  const colors = useMapColors();
  const lists = useLists((s) => s.lists);
  const [composing, setComposing] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={styles.fill}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.label }]}>Lists</Text>
        <Pressable
          onPress={() => setComposing(true)}
          accessibilityLabel="New list"
          style={[styles.newButton, { backgroundColor: colors.visited }]}
        >
          <Text style={styles.newLabel}>New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {lists.length === 0 ? (
          <Text style={[styles.empty, { color: colors.label }]}>
            No lists yet. Make one for a trip you’re planning, a set you’re working
            through, or somewhere you just want to remember.
          </Text>
        ) : (
          lists.map((list) => <ListCard key={list.id} id={list.id} colors={colors} />)
        )}
      </ScrollView>

      <ComposeList visible={composing} onClose={() => setComposing(false)} colors={colors} />
    </SafeAreaView>
  );
}

/**
 * Progress is computed from the visits store, not stored on the list — so a list
 * ticks itself off as you travel, with no chance of the two disagreeing.
 */
function ListCard({ id, colors }: { id: number; colors: MapColors }) {
  const list = useLists((s) => s.lists.find((l) => l.id === id));
  const items = useLists((s) => s.itemsByList.get(id) ?? []);
  const byKey = useVisits((s) => s.byKey);

  if (!list) return null;

  const done = items.filter((i) => byKey.has(`${i.kind}:${i.placeId}`)).length;
  const fraction = items.length > 0 ? done / items.length : 0;
  const complete = items.length > 0 && done === items.length;

  return (
    <Pressable
      onPress={() => router.push(`/list/${id}`)}
      style={[styles.card, { backgroundColor: colors.unvisited }]}
    >
      <Text style={styles.cardEmoji}>{list.emoji}</Text>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: colors.label }]} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={[styles.cardCount, { color: colors.label }]}>
          {items.length === 0
            ? 'Empty'
            : complete
              ? `All ${items.length} done`
              : `${done} of ${items.length}`}
        </Text>
        {items.length > 0 && (
          <View style={[styles.track, { backgroundColor: colors.unvisitedBorder }]}>
            <View
              style={[
                styles.trackFill,
                { backgroundColor: colors.visited, width: `${fraction * 100}%` },
              ]}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ComposeList({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: MapColors;
}) {
  const createList = useLists((s) => s.createList);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]!);

  const submit = async () => {
    const created = await createList(name, emoji);
    setName('');
    setEmoji(EMOJI_CHOICES[0]!);
    onClose();
    // Straight into the new list — you made it to put places on it.
    if (created) router.push(`/list/${created.id}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.labelHalo }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: colors.label }]}>New list</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Japan 2027"
            placeholderTextColor={colors.unvisitedBorder}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[styles.input, { color: colors.label, backgroundColor: colors.unvisited }]}
          />

          <View style={styles.emojiRow}>
            {EMOJI_CHOICES.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setEmoji(choice)}
                style={[
                  styles.emojiOption,
                  choice === emoji && { backgroundColor: colors.unvisited },
                ]}
              >
                <Text style={styles.emojiGlyph}>{choice}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={submit}
            disabled={!name.trim()}
            style={[
              styles.createButton,
              { backgroundColor: name.trim() ? colors.visited : colors.unvisitedBorder },
            ]}
          >
            <Text style={styles.createLabel}>Create</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 30, fontWeight: '700' },
  newButton: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999 },
  newLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  empty: { textAlign: 'center', marginTop: 60, paddingHorizontal: 30, opacity: 0.6, lineHeight: 21 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14 },
  cardEmoji: { fontSize: 30 },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 17, fontWeight: '600' },
  cardCount: { fontSize: 12, opacity: 0.6 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 3 },
  trackFill: { height: '100%', borderRadius: 3 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 17 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiOption: { padding: 7, borderRadius: 10 },
  emojiGlyph: { fontSize: 22 },
  createButton: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  createLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
