import { create } from 'zustand';
import type { SimulationSlice } from './slices/simulationSlice';
import { createSimulationSlice } from './slices/simulationSlice';
import type { PlaybackSlice } from './slices/playbackSlice';
import { createPlaybackSlice } from './slices/playbackSlice';
import type { UiSlice } from './slices/uiSlice';
import { createUiSlice } from './slices/uiSlice';
import type { HistorySlice } from './slices/historySlice';
import { createHistorySlice } from './slices/historySlice';
import type { StagedSlice } from './slices/stagedSlice';
import { createStagedSlice } from './slices/stagedSlice';
import type { BodyPair, CollisionEvent } from '../types';

// ─── Collision Slice (inline — small enough to not warrant a separate file) ───

export interface CollisionSlice {
  activeCollisions: [BodyPair, CollisionEvent][];
  collisionCooldowns: BodyPair[];

  registerCollision: (event: CollisionEvent) => void;
  clearCollision: (pair: BodyPair) => void;
  setCooldown: (pair: BodyPair, active: boolean) => void;
}

// ─── Composite Store Type ───

export type TrifectaStore = SimulationSlice &
  PlaybackSlice &
  UiSlice &
  HistorySlice &
  StagedSlice &
  CollisionSlice;

// ─── Store Creation ───

export const useStore = create<TrifectaStore>()((...a) => ({
  ...createSimulationSlice(...a),
  ...createPlaybackSlice(...a),
  ...createUiSlice(...a),
  ...createHistorySlice(...a),
  ...createStagedSlice(...a),

  // ─── Collision Slice (inline) ───
  activeCollisions: [],
  collisionCooldowns: [],

  registerCollision: (event: CollisionEvent) => {
    const [set, get] = [a[0], a[1]];
    const current = get().activeCollisions;
    // Replace existing entry for this pair or add new
    const filtered = current.filter(([p]) => p !== event.pair);
    set({ activeCollisions: [...filtered, [event.pair, event]] });
  },

  clearCollision: (pair: BodyPair) => {
    const [set, get] = [a[0], a[1]];
    set({
      activeCollisions: get().activeCollisions.filter(([p]) => p !== pair),
    });
  },

  setCooldown: (pair: BodyPair, active: boolean) => {
    const [set, get] = [a[0], a[1]];
    const cooldowns = get().collisionCooldowns;
    if (active && !cooldowns.includes(pair)) {
      set({ collisionCooldowns: [...cooldowns, pair] });
    } else if (!active) {
      set({ collisionCooldowns: cooldowns.filter((p) => p !== pair) });
    }
  },
}));

/** Non-React access for the renderer and simulation loop */
export const getState = useStore.getState;
