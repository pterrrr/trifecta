import { useEffect } from 'react';
import { readSeedFromUrl, decodeSeed } from '../seed';
import { getState } from '../state/store';

/**
 * On mount, reads the `?seed=` URL parameter and loads it as the initial
 * configuration if present and valid. Runs once — no URL history updates.
 */
export function useUrlSeed(): void {
  useEffect(() => {
    const raw = readSeedFromUrl();
    if (!raw) return;
    const decoded = decodeSeed(raw);
    if (decoded) {
      getState().loadSeed(decoded);
    }
  }, []);
}
