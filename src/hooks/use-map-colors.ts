import { useColorScheme } from 'react-native';

import { resolveColors, type MapColors } from '../constants/palette';
import { useSettings } from '../stores/settings';

/**
 * The single source of colour for anything that paints a visited place.
 *
 * Reading the appearance and the chosen accent together in one hook means a screen
 * can never end up half-recoloured — every consumer re-renders on the same two
 * inputs. Components should call this rather than indexing MapPalette directly,
 * which would pin them to the default accent.
 */
export function useMapColors(): MapColors {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const accentId = useSettings((s) => s.accentId);
  return resolveColors(scheme, accentId);
}
