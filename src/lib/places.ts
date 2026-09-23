import { useEffect, useState } from 'react';

import {
  citiesByIds,
  rarestCities,
  searchCities,
  searchCitiesByRarity,
  type City,
  type Country,
  type Landmark,
  type Park,
} from '../db/reference';
import type { PlaceKind } from '../db/schema';
import { useCatalogue } from './catalogue';

/**
 * Turning a (kind, placeId) pair into something displayable.
 *
 * Countries, parks and landmarks are resident so they resolve synchronously. Cities
 * are the exception — 34k of them stay on disk — which is why anything that lists
 * places has to tolerate an async gap. Keeping that asymmetry in one module means
 * the screens don't each reinvent it.
 */

export type PlaceInfo = {
  kind: PlaceKind;
  id: string;
  title: string;
  subtitle: string;
  /** Only cities carry one; drives the rarity meter on a row. */
  rarity?: number;
};

export function countryInfo(c: Country): PlaceInfo {
  return {
    kind: 'country',
    id: c.id,
    title: `${c.emoji}  ${c.name}`,
    subtitle: c.continent,
  };
}

export function parkInfo(p: Park): PlaceInfo {
  return {
    kind: 'park',
    id: p.id,
    title: p.name,
    subtitle: [p.designation, p.states].filter(Boolean).join(' · '),
  };
}

export function landmarkInfo(l: Landmark): PlaceInfo {
  return {
    kind: 'landmark',
    id: l.id,
    title: l.name,
    subtitle: l.kind.replace('wonder_', '').replace('_', ' '),
  };
}

export function cityInfo(c: City, countries: Country[]): PlaceInfo {
  const country = countries.find((x) => x.id === c.country_id);
  return {
    kind: 'city',
    id: c.id,
    title: c.name,
    // The rarity number is gone from the subtitle — the meter says it better.
    subtitle: [
      country ? `${country.emoji} ${country.name}` : c.country_id,
      c.admin1_name,
      c.population.toLocaleString(),
    ]
      .filter(Boolean)
      .join(' · '),
    rarity: c.rarity,
  };
}

/**
 * Resolves a mixed bag of list entries to display rows, in the order given.
 *
 * Cities are fetched in one query rather than per row — a list of thirty places
 * would otherwise be thirty round trips to SQLite while the screen is scrolling.
 */
export function useResolvedPlaces(entries: { kind: PlaceKind; placeId: string }[]): PlaceInfo[] {
  const { countries, parks, landmarks } = useCatalogue();
  const [cities, setCities] = useState<Map<string, City>>(new Map());

  const cityIds = entries.filter((e) => e.kind === 'city').map((e) => e.placeId);
  const cityKey = cityIds.join(',');

  useEffect(() => {
    if (cityIds.length === 0) {
      setCities(new Map());
      return;
    }
    let cancelled = false;
    citiesByIds(cityIds)
      .then((rows) => {
        if (!cancelled) setCities(new Map(rows.map((r) => [r.id, r])));
      })
      .catch((err) => console.warn('Failed to resolve cities', err));
    return () => {
      cancelled = true;
    };
    // Keyed on the joined ids so this re-runs when the set changes, not when the
    // array identity does — entries is rebuilt on every store write.
  }, [cityKey]);

  return entries.flatMap((entry) => {
    switch (entry.kind) {
      case 'country': {
        const c = countries.find((x) => x.id === entry.placeId);
        return c ? [countryInfo(c)] : [];
      }
      case 'park': {
        const p = parks.find((x) => x.id === entry.placeId);
        return p ? [parkInfo(p)] : [];
      }
      case 'landmark': {
        const l = landmarks.find((x) => x.id === entry.placeId);
        return l ? [landmarkInfo(l)] : [];
      }
      case 'city': {
        const c = cities.get(entry.placeId);
        // Not an error — the city query simply hasn't landed yet.
        return c ? [cityInfo(c, countries)] : [];
      }
    }
  });
}

/**
 * Search across one kind of place. Cities go through FTS5 and are debounced; the
 * rest are small enough to filter in memory as you type.
 */
export type CitySort = 'relevance' | 'rarest';

export function usePlaceSearch(
  kind: PlaceKind,
  query: string,
  sort: CitySort = 'relevance'
): PlaceInfo[] {
  const { countries, parks, landmarks } = useCatalogue();
  const [cityResults, setCityResults] = useState<City[]>([]);

  useEffect(() => {
    if (kind !== 'city') return;
    const term = query.trim();

    // With no search term, "rarest" still has an answer — browse the obscure end of
    // the catalogue. "Relevance" does not, so it stays empty until you type.
    if (!term) {
      if (sort === 'rarest') {
        let cancelled = false;
        rarestCities()
          .then((rows) => !cancelled && setCityResults(rows))
          .catch((err) => console.warn('Rare city browse failed', err));
        return () => {
          cancelled = true;
        };
      }
      setCityResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const run = sort === 'rarest' ? searchCitiesByRarity(term) : searchCities(term);
      run
        .then((rows) => !cancelled && setCityResults(rows))
        .catch((err) => console.warn('City search failed', err));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, query, sort]);

  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  switch (kind) {
    case 'country':
      return countries.filter((c) => match(c.name)).map(countryInfo);
    case 'park':
      return parks.filter((p) => match(p.full_name)).map(parkInfo);
    case 'landmark':
      return landmarks.filter((l) => match(l.name)).map(landmarkInfo);
    case 'city':
      return cityResults.map((c) => cityInfo(c, countries));
  }
}
