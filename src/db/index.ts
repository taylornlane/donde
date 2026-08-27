import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

/**
 * The user's own database — visits, wishlist, badges, settings. Small, mutable,
 * and the only thing worth backing up or syncing. `enableChangeListener` is what
 * makes drizzle's `useLiveQuery` re-run when we write, so screens update without
 * any manual invalidation.
 */
export const userSqlite = openDatabaseSync('user.db', { enableChangeListener: true });

export const db = drizzle(userSqlite, { schema });

export { schema };
