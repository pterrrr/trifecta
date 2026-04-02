import { useStore } from '../state/store';
import type { ActiveBodyFocus } from '../types';

/**
 * Hook for reading and setting the active body focus.
 * Connected to uiSlice.activeBodyFocus.
 *
 * Usage:
 *   const { activeBodyFocus, setActiveBodyFocus } = useActiveBodyFocus();
 *   setActiveBodyFocus('r'); // focus Body R
 *   setActiveBodyFocus(null); // clear focus
 */
export function useActiveBodyFocus(): {
  activeBodyFocus: ActiveBodyFocus;
  setActiveBodyFocus: (body: ActiveBodyFocus) => void;
} {
  const activeBodyFocus = useStore((s) => s.activeBodyFocus);
  const setActiveBodyFocus = useStore((s) => s.setActiveBodyFocus);
  return { activeBodyFocus, setActiveBodyFocus };
}
