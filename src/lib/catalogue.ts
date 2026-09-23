import { create } from 'zustand';

import {
  allCountries,
  allLandmarks,
  allParks,
  catalogueTotals,
  citiesByIds,
  openReferenceDb,
  type City,
  type Country,
  type Landmark,
  type Park,
} from '../db/reference';
import { useLists } from '../stores/lists';
import { useSettings } from '../stores/settings';
import { useVisits } from '../stores/visits';

/**
 * The slices of the catalogue small enough to keep resident: every country (252),
 * every NPS unit (~470), every landmark (21). Together that is a few hundred KB and
 * it is what the stats, badges and list screens all read from, so loading it once at
 * boot removes a query from essentially every render path in the app.
 *
 * Cities are the exception — 34,124 of them stay on disk and are reached by search
 * or by viewport. The only cities held here are the ones the user has visited, which
 * the map and the score need in full.
 */

type CatalogueState = {
  ready: boolean;
  countries: Country[];
  parks: Park[];
  landmarks: Landmark[];
  totals: Awaited<ReturnType<typeof catalogueTotals>> | null;
  /** Full rows for visited cities, kept in sync with the visits store. */
  visitedCities: City[];
  load: () => Promise<void>;
  refreshVisitedCities: () => Promise<void>;
};

export const useCatalogue = create<CatalogueState>((set, get) => ({
  ready: false,
  countries: [],
  parks: [],
  landmarks: [],
  totals: null,
  visitedCities: [],

  load: async () => {
    await openReferenceDb();
    const [countries, parks, landmarks, totals] = await Promise.all([
      allCountries(),
      allParks(),
      allLandmarks(),
      catalogueTotals(),
    ]);
    set({ countries, parks, landmarks, totals, ready: true });
    await get().refreshVisitedCities();
  },

  refreshVisitedCities: async () => {
    const ids = [...useVisits.getState().idsByKind.city];
    set({ visitedCities: await citiesByIds(ids) });
  },
}));

/**
 * Boots both databases in the right order and wires the two stores together.
 *
 * The subscription is the important part: the visits store is the write path, but
 * the map needs full city rows (coordinates, rarity) that the visits table does not
 * carry. Rather than have every caller remember to re-hydrate, we watch the visited
 * city set and re-query whenever it changes.
 */
export async function bootstrap() {
  // Settings first, and awaited: the accent decides what colour the map paints its
  // fills, so loading it after the first render would flash the default orange.
  await useSettings.getState().load();
  await useVisits.getState().load();
  await useLists.getState().load();
  await useCatalogue.getState().load();

  useVisits.subscribe((state, prev) => {
    if (state.idsByKind.city !== prev.idsByKind.city) {
      useCatalogue.getState().refreshVisitedCities();
    }
  });
}
