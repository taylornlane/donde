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
    /** Optional, and deliberately coarse — most people remember the year, not the date. */
    firstVisitedYear: integer('first_visited_year'),
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

/** Bucket list. Same shape as a visit, kept separate so it never pollutes stats. */
export const wishlist = sqliteTable(
  'wishlist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: PLACE_KINDS }).notNull(),
    placeId: text('place_id').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex('wishlist_kind_place_unq').on(t.kind, t.placeId)]
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
export type NewVisit = typeof visits.$inferInsert;
export type Badge = typeof badges.$inferSelect;
