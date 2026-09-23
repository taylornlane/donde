import { and, eq } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { db } from '../db';
import { PLACE_KINDS, visits, type PlaceKind, type Visit } from '../db/schema';

/**
 * Every visit the user has ever recorded, held in memory.
 *
 * This looks like premature caching but it is the opposite: the set is tiny — even a
 * hall-of-fame traveller tops out in the low thousands of rows — while the questions
 * we ask of it are constant and everywhere ("is this pin filled?" on 300 map features
 * per frame). Keeping it resident lets the map, the lists and the stats all read
 * synchronously, and lets us join against the 50k-row catalogue in JS instead of
 * attaching two databases together.
 *
 * SQLite remains the source of truth. Writes go to disk first and the in-memory set
 * follows, so a crash can lose a frame of UI state but never a recorded visit.
 */

type Key = `${PlaceKind}:${string}`;

const keyOf = (kind: PlaceKind, placeId: string): Key => `${kind}:${placeId}`;

type IdsByKind = Record<PlaceKind, Set<string>>;

type VisitsState = {
  ready: boolean;
  /** Key → row for visited places. Absence means not visited. */
  byKey: Map<Key, Visit>;
  /**
   * Derived at write time rather than in a selector. Hooks hand these straight to
   * `useSyncExternalStore`, which compares by reference — building a fresh Set inside
   * a selector would make every snapshot look changed and re-render the map forever.
   */
  idsByKind: IdsByKind;
  load: () => Promise<void>;
  isVisited: (kind: PlaceKind, placeId: string) => boolean;
  toggle: (kind: PlaceKind, placeId: string) => Promise<boolean>;
  setVisited: (kind: PlaceKind, placeId: string, visited: boolean) => Promise<void>;
  setNote: (kind: PlaceKind, placeId: string, note: string | null) => Promise<void>;
  setVisitedOn: (kind: PlaceKind, placeId: string, visitedOn: string | null) => Promise<void>;
};

const emptyIds = (): IdsByKind =>
  Object.fromEntries(PLACE_KINDS.map((k) => [k, new Set<string>()])) as IdsByKind;

function deriveIds(byKey: Map<Key, Visit>): IdsByKind {
  const ids = emptyIds();
  for (const row of byKey.values()) ids[row.kind].add(row.placeId);
  return ids;
}

export const useVisits = create<VisitsState>((set, get) => {
  /** Single commit point, so `byKey` and `idsByKind` can never drift apart. */
  const commit = (byKey: Map<Key, Visit>) => set({ byKey, idsByKind: deriveIds(byKey) });

  return {
    ready: false,
    byKey: new Map(),
    idsByKind: emptyIds(),

    load: async () => {
      const rows = await db.select().from(visits);
      const byKey = new Map<Key, Visit>();
      for (const row of rows) byKey.set(keyOf(row.kind, row.placeId), row);
      commit(byKey);
      set({ ready: true });
    },

    isVisited: (kind, placeId) => get().byKey.has(keyOf(kind, placeId)),

    toggle: async (kind, placeId) => {
      const next = !get().isVisited(kind, placeId);
      await get().setVisited(kind, placeId, next);
      Haptics.impactAsync(
        next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
      return next;
    },

    setVisited: async (kind, placeId, visited) => {
      const key = keyOf(kind, placeId);

      if (!visited) {
        await db.delete(visits).where(and(eq(visits.kind, kind), eq(visits.placeId, placeId)));
        const byKey = new Map(get().byKey);
        byKey.delete(key);
        commit(byKey);
        return;
      }

      // onConflictDoNothing keeps a double-tap from racing into a unique-constraint
      // error, but it also means `returning()` is empty when the row already existed.
      const [inserted] = await db
        .insert(visits)
        .values({ kind, placeId })
        .onConflictDoNothing()
        .returning();

      const stored =
        inserted ??
        (await db.query.visits.findFirst({
          where: and(eq(visits.kind, kind), eq(visits.placeId, placeId)),
        }));

      if (!stored) return;
      const byKey = new Map(get().byKey);
      byKey.set(key, stored);
      commit(byKey);
    },

    setNote: (kind, placeId, note) => patch(kind, placeId, { note }),

    setVisitedOn: (kind, placeId, visitedOn) => patch(kind, placeId, { visitedOn }),
  };

  /** Shared write path for metadata fields, which only apply to an existing visit. */
  async function patch(
    kind: PlaceKind,
    placeId: string,
    fields: Partial<Pick<Visit, 'note' | 'visitedOn'>>
  ) {
    const key = keyOf(kind, placeId);
    if (!get().byKey.has(key)) await get().setVisited(kind, placeId, true);

    const [row] = await db
      .update(visits)
      .set({ ...fields, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(visits.kind, kind), eq(visits.placeId, placeId)))
      .returning();

    if (!row) return;
    const byKey = new Map(get().byKey);
    byKey.set(key, row);
    commit(byKey);
  }
});

/**
 * Subscribing to the whole store would re-render every screen on any change. These
 * keep a map layer or a list row subscribed to the narrowest slice that affects it.
 */
export const useIsVisited = (kind: PlaceKind, placeId: string) =>
  useVisits((s) => s.byKey.has(keyOf(kind, placeId)));

export const useVisitedIds = (kind: PlaceKind) => useVisits((s) => s.idsByKind[kind]);

export const useVisitCount = (kind: PlaceKind) => useVisits((s) => s.idsByKind[kind].size);
