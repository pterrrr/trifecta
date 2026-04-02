import { useStore } from './store';
import type { TrifectaStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { encodeSeed } from '../seed';

// ─── Selector functions ───

const bodiesSelector = (s: TrifectaStore) => s.bodies;
const globalsSelector = (s: TrifectaStore) => s.globals;
const derivedSelector = (s: TrifectaStore) => s.derived;

const playbackSelector = (s: TrifectaStore) => ({
  isPlaying: s.isPlaying,
  speed: s.speed,
  mode: s.mode,
});

const filtersSelector = (s: TrifectaStore) => s.filters;
const modeSelector = (s: TrifectaStore) => s.mode;

const currentSeedSelector = (s: TrifectaStore): string => {
  const bodies = s.mode === 'lab' ? (s.stagedBodies ?? s.bodies) : s.bodies;
  const globals = s.mode === 'lab' ? (s.stagedGlobals ?? s.globals) : s.globals;
  return encodeSeed({ bodies, globals, time: 0 });
};

// ─── Hook-based selectors with shallow equality ───

export const useSelectBodies = () => useStore(bodiesSelector);
export const useSelectGlobals = () => useStore(globalsSelector);
export const useSelectDerived = () => useStore(derivedSelector);
export const useSelectPlayback = () => useStore(useShallow(playbackSelector));
export const useSelectFilters = () => useStore(useShallow(filtersSelector));
export const useSelectMode = () => useStore(modeSelector);
export const useSelectCurrentSeed = () => useStore(currentSeedSelector);

// ─── Plain selector functions (for non-hook contexts) ───

export {
  bodiesSelector as selectBodies,
  globalsSelector as selectGlobals,
  derivedSelector as selectDerived,
  playbackSelector as selectPlayback,
  filtersSelector as selectFilters,
  modeSelector as selectMode,
  currentSeedSelector as selectCurrentSeed,
};
