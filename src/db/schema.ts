import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * User-owned data only. Everything here lives in `user.db`, which is the file we
 * back up and (later) sync. The catalogue of places — countries, cities, parks,
 * landmarks — lives in a separate read-only `reference.db` shipped with the app,
 * queried via src/db/reference.ts. Rows below reference it by string id, never by
 * foreign key, so we can ship a new catalogue without touching user data.
 */

/** Discriminator for every kind of place a visit can point at. */
export const PLACE_KINDS = ['country', 'city', 'park', 'landmark'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const visits = sqliteTable(
  'visits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: PLACE_KINDS }).notNull(),
    /** Id in the reference catalogue: ISO-3166 alpha-2, geonameId, NPS parkCode, or landmark slug. */
    placeId: text('place_id').notNull(),
    /**
     * When you were there, at whatever precision you actually remember:
     * "2019", "2019-04", or "2019-04-12". Stored as a partial ISO string rather
     * than a real date, because forcing a full date on someone who only recalls
     * "sometime in 2019" means they either lie or leave it blank — and a wrong
     * date is worse than a vague one.
     *
     * Sorts and groups correctly as text, since ISO prefixes are ordered.
     */
    visitedOn: text('visited_on'),
    note: text('note'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('visits_kind_place_unq').on(t.kind, t.placeId),
    index('visits_kind_idx').on(t.kind),
  ]
);

/**
 * Named checklists — "Japan 2027", "Parks to finish", "Someday".
 *
 * Deliberately separate from visits, and never counted in stats: a list is about
 * intent, and letting somewhere you merely want to go inflate your country count
 * would make every number in the app a lie.
 */
export const lists = sqliteTable('lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('📍'),
  /** Manual ordering, so the list you are actively planning can sit at the top. */
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * A place on a list.
 *
 * There is no `checked` column on purpose. Whether an entry is ticked is derived
 * from whether a matching row exists in `visits`, which means marking somewhere
 * visited ticks it on every list it appears on, for free and with no chance of the
 * two disagreeing. A stored flag would need syncing, and would eventually drift.
 */
export const listItems = sqliteTable(
  'list_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listId: integer('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: PLACE_KINDS }).notNull(),
    placeId: text('place_id').notNull(),
    note: text('note'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('list_items_unq').on(t.listId, t.kind, t.placeId),
    index('list_items_list_idx').on(t.listId),
  ]
);

/**
 * Earned badges are persisted rather than recomputed on read, so that "earned on"
 * dates survive changes to the badge rules and we can animate the moment one unlocks.
 */
export const badges = sqliteTable('badges', {
  code: text('code').primaryKey(),
  earnedAt: integer('earned_at')
    .notNull()
    .default(sql`(unixepoch())`),
});


/** Freeform key/value for preferences (map style, units, home country). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Visit = typeof visits.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type Badge = typeof badges.$inferSelect;
