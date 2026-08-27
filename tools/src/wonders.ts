/**
 * The wonder lists are short, fixed, and have no authoritative machine-readable
 * source worth depending on, so they live here as data rather than as a fetch.
 *
 * Three lists, because "the seven wonders" means different things to different
 * people and the app should let you track whichever you care about:
 *   - wonder_new     — New7Wonders of the World (2007 poll)
 *   - wonder_ancient — the classical seven, six of which no longer exist
 *   - wonder_nature  — New7Wonders of Nature (2011 poll)
 *
 * The ancient list is deliberately included despite six being rubble: the Giza
 * pyramids are still standing and visitable, and the site coordinates are where the
 * others stood, which is the thing people actually go to see.
 */

export type WonderSeed = {
  id: string;
  name: string;
  kind: 'wonder_new' | 'wonder_ancient' | 'wonder_nature';
  countryId: string;
  lat: number;
  lng: number;
  /** False for the six ancient wonders that no longer exist. */
  extant: boolean;
};

export const WONDERS: WonderSeed[] = [
  // New7Wonders of the World (2007)
  { id: 'great-wall', name: 'Great Wall of China', kind: 'wonder_new', countryId: 'CN', lat: 40.4319, lng: 116.5704, extant: true },
  { id: 'petra', name: 'Petra', kind: 'wonder_new', countryId: 'JO', lat: 30.3285, lng: 35.4444, extant: true },
  { id: 'christ-redeemer', name: 'Christ the Redeemer', kind: 'wonder_new', countryId: 'BR', lat: -22.9519, lng: -43.2105, extant: true },
  { id: 'machu-picchu', name: 'Machu Picchu', kind: 'wonder_new', countryId: 'PE', lat: -13.1631, lng: -72.5450, extant: true },
  { id: 'chichen-itza', name: 'Chichén Itzá', kind: 'wonder_new', countryId: 'MX', lat: 20.6843, lng: -88.5678, extant: true },
  { id: 'colosseum', name: 'Colosseum', kind: 'wonder_new', countryId: 'IT', lat: 41.8902, lng: 12.4922, extant: true },
  { id: 'taj-mahal', name: 'Taj Mahal', kind: 'wonder_new', countryId: 'IN', lat: 27.1751, lng: 78.0421, extant: true },

  // Ancient seven. Giza is both an honorary New7Wonder and the only survivor.
  { id: 'giza-pyramids', name: 'Great Pyramid of Giza', kind: 'wonder_ancient', countryId: 'EG', lat: 29.9792, lng: 31.1342, extant: true },
  { id: 'hanging-gardens', name: 'Hanging Gardens of Babylon', kind: 'wonder_ancient', countryId: 'IQ', lat: 32.5364, lng: 44.4208, extant: false },
  { id: 'statue-of-zeus', name: 'Statue of Zeus at Olympia', kind: 'wonder_ancient', countryId: 'GR', lat: 37.6380, lng: 21.6300, extant: false },
  { id: 'temple-of-artemis', name: 'Temple of Artemis at Ephesus', kind: 'wonder_ancient', countryId: 'TR', lat: 37.9497, lng: 27.3639, extant: false },
  { id: 'mausoleum-halicarnassus', name: 'Mausoleum at Halicarnassus', kind: 'wonder_ancient', countryId: 'TR', lat: 37.0379, lng: 27.4241, extant: false },
  { id: 'colossus-of-rhodes', name: 'Colossus of Rhodes', kind: 'wonder_ancient', countryId: 'GR', lat: 36.4510, lng: 28.2278, extant: false },
  { id: 'lighthouse-alexandria', name: 'Lighthouse of Alexandria', kind: 'wonder_ancient', countryId: 'EG', lat: 31.2139, lng: 29.8856, extant: false },

  // New7Wonders of Nature (2011)
  { id: 'iguazu-falls', name: 'Iguazú Falls', kind: 'wonder_nature', countryId: 'AR', lat: -25.6953, lng: -54.4367, extant: true },
  { id: 'ha-long-bay', name: 'Hạ Long Bay', kind: 'wonder_nature', countryId: 'VN', lat: 20.9101, lng: 107.1839, extant: true },
  { id: 'jeju-island', name: 'Jeju Island', kind: 'wonder_nature', countryId: 'KR', lat: 33.4890, lng: 126.4983, extant: true },
  { id: 'puerto-princesa-river', name: 'Puerto Princesa Underground River', kind: 'wonder_nature', countryId: 'PH', lat: 10.1939, lng: 118.9256, extant: true },
  { id: 'table-mountain', name: 'Table Mountain', kind: 'wonder_nature', countryId: 'ZA', lat: -33.9628, lng: 18.4098, extant: true },
  { id: 'komodo-island', name: 'Komodo Island', kind: 'wonder_nature', countryId: 'ID', lat: -8.5586, lng: 119.4517, extant: true },
  { id: 'amazon-rainforest', name: 'Amazon Rainforest', kind: 'wonder_nature', countryId: 'BR', lat: -3.4653, lng: -62.2159, extant: true },
];
