import { and, asc, eq } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { db } from '../db';
import { listItems, lists, type List, type ListItem, type PlaceKind } from '../db/schema';

/**
 * Checklists of places you want to go.
 *
 * Held resident like visits, and for the same reason: the sets are small and the
 * questions constant ("is this place already on a list?" on every search row). Both
 * lists and their items load in one pass at boot.
 *
 * Nothing here records whether an item is *done* — that is read from the visits
 * store at render time. See the note on `listItems` in the schema.
 */

type ListsState = {
  ready: boolean;
  lists: List[];
  /** listId → its items. */
  itemsByList: Map<number, ListItem[]>;
  load: () => Promise<void>;
  createList: (name: string, emoji: string) => Promise<List | null>;
  renameList: (id: number, name: string, emoji: string) => Promise<void>;
  deleteList: (id: number) => Promise<void>;
  addPlace: (listId: number, kind: PlaceKind, placeId: string) => Promise<void>;
  removePlace: (listId: number, kind: PlaceKind, placeId: string) => Promise<void>;
  isOnList: (listId: number, kind: PlaceKind, placeId: string) => boolean;
};

export const useLists = create<ListsState>((set, get) => ({
  ready: false,
  lists: [],
  itemsByList: new Map(),

  load: async () => {
    const [allLists, allItems] = await Promise.all([
      db.select().from(lists).orderBy(asc(lists.sortOrder), asc(lists.id)),
      db.select().from(listItems).orderBy(asc(listItems.id)),
    ]);

    const itemsByList = new Map<number, ListItem[]>();
    for (const l of allLists) itemsByList.set(l.id, []);
    for (const item of allItems) {
      // A list could have been deleted between the two queries; skip orphans rather
      // than creating a phantom entry keyed to a list that no longer exists.
      itemsByList.get(item.listId)?.push(item);
    }

    set({ lists: allLists, itemsByList, ready: true });
  },

  createList: async (name, emoji) => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // New lists go to the top: the one you just made is the one you are planning.
    const lowest = get().lists[0]?.sortOrder ?? 0;
    const [row] = await db
      .insert(lists)
      .values({ name: trimmed, emoji, sortOrder: lowest - 1 })
      .returning();
    if (!row) return null;

    const itemsByList = new Map(get().itemsByList);
    itemsByList.set(row.id, []);
    set({ lists: [row, ...get().lists], itemsByList });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return row;
  },

  renameList: async (id, name, emoji) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const [row] = await db
      .update(lists)
      .set({ name: trimmed, emoji })
      .where(eq(lists.id, id))
      .returning();
    if (!row) return;
    set({ lists: get().lists.map((l) => (l.id === id ? row : l)) });
  },

  deleteList: async (id) => {
    await db.delete(listItems).where(eq(listItems.listId, id));
    await db.delete(lists).where(eq(lists.id, id));
    const itemsByList = new Map(get().itemsByList);
    itemsByList.delete(id);
    set({ lists: get().lists.filter((l) => l.id !== id), itemsByList });
  },

  addPlace: async (listId, kind, placeId) => {
    if (get().isOnList(listId, kind, placeId)) return;

    const [row] = await db
      .insert(listItems)
      .values({ listId, kind, placeId })
      .onConflictDoNothing()
      .returning();
    if (!row) return;

    const itemsByList = new Map(get().itemsByList);
    itemsByList.set(listId, [...(itemsByList.get(listId) ?? []), row]);
    set({ itemsByList });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },

  removePlace: async (listId, kind, placeId) => {
    await db
      .delete(listItems)
      .where(
        and(
          eq(listItems.listId, listId),
          eq(listItems.kind, kind),
          eq(listItems.placeId, placeId)
        )
      );
    const itemsByList = new Map(get().itemsByList);
    itemsByList.set(
      listId,
      (itemsByList.get(listId) ?? []).filter(
        (i) => !(i.kind === kind && i.placeId === placeId)
      )
    );
    set({ itemsByList });
  },

  isOnList: (listId, kind, placeId) =>
    (get().itemsByList.get(listId) ?? []).some(
      (i) => i.kind === kind && i.placeId === placeId
    ),
}));

export const useListItems = (listId: number) =>
  useLists((s) => s.itemsByList.get(listId) ?? EMPTY);

/** Stable identity so a list with no items doesn't re-render on every store write. */
const EMPTY: ListItem[] = [];
