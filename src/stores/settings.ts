import { eq } from 'drizzle-orm';
import { create } from 'zustand';

import { db } from '../db';
import { settings } from '../db/schema';
import { DEFAULT_ACCENT_ID } from '../constants/palette';

/**
 * User preferences, persisted in the `settings` key/value table.
 *
 * Same contract as the visits store: write to disk first, then update memory, so a
 * preference can never appear to have been saved when it wasn't. The table is
 * key/value rather than a column per setting because these come and go during
 * development and a schema migration per toggle is not worth it.
 */

const ACCENT_KEY = 'map.accent';

type SettingsState = {
  ready: boolean;
  accentId: string;
  load: () => Promise<void>;
  setAccent: (id: string) => Promise<void>;
};

export const useSettings = create<SettingsState>((set) => ({
  ready: false,
  accentId: DEFAULT_ACCENT_ID,

  load: async () => {
    const rows = await db.select().from(settings).where(eq(settings.key, ACCENT_KEY));
    set({ accentId: rows[0]?.value ?? DEFAULT_ACCENT_ID, ready: true });
  },

  setAccent: async (id) => {
    await db
      .insert(settings)
      .values({ key: ACCENT_KEY, value: id })
      .onConflictDoUpdate({ target: settings.key, set: { value: id } });
    set({ accentId: id });
  },
}));
