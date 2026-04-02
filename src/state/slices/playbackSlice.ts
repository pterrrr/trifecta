import type { StateCreator } from 'zustand';
import type { InteractionMode, BodyState } from '../../types';
import type { TrifectaStore } from '../store';
import { integrateStep } from '../../engine/integrator';
import { computeDerived } from '../../engine/derived';
import { BASE_DT } from '../../constants/physics';

export interface PlaybackSlice {
  isPlaying: boolean;
  speed: number;
  mode: InteractionMode;

  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setSpeed: (speed: number) => void;
  setMode: (mode: InteractionMode) => void;
  reset: () => void;
  stepForward: (dt: number) => void;
}

export const createPlaybackSlice: StateCreator<
  TrifectaStore,
  [],
  [],
  PlaybackSlice
> = (set, get) => ({
  isPlaying: false,
  speed: 1.0,
  mode: 'lab',

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  togglePlayPause: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setSpeed: (speed) => {
    const clamped = Math.min(10.0, Math.max(0.1, speed));
    set({ speed: clamped });
  },

  setMode: (mode) => {
    const store = get();
    const currentMode = store.mode;
    if (currentMode === mode) return;

    if (currentMode === 'lab' && mode === 'live') {
      // Lab → Live: commit staged buffer, resume simulation
      store.commitStaged();
      set({ mode: 'live' });
    } else if (currentMode === 'live' && mode === 'lab') {
      // Live → Lab: pause, snapshot active → staged
      set({ mode: 'lab', isPlaying: false });
      store.snapshotToStaged();
    }
  },

  reset: () => {
    const { initialConditions, clearTrails, clearGraphHistory } = get();
    set({
      bodies: initialConditions.bodies.map((b) => ({
        ...b,
        position: { ...b.position },
        velocity: { ...b.velocity },
      })) as [
        TrifectaStore['bodies'][0],
        TrifectaStore['bodies'][1],
        TrifectaStore['bodies'][2],
      ],
      globals: { ...initialConditions.globals },
      time: 0,
      isPlaying: false,
      activeCollisions: [],
      collisionCooldowns: [],
    });
    clearTrails();
    clearGraphHistory();
  },

  stepForward: (dt) => {
    const store = get();
    if (store.isPlaying) return;

    const bodies = store.bodies as [BodyState, BodyState, BodyState];
    const { globals, time } = store;
    const step = dt ?? BASE_DT;

    const nextBodies = integrateStep(bodies, globals, step);
    const nextTime = time + step;
    const nextDerived = computeDerived(nextBodies, globals);

    set({ bodies: nextBodies, time: nextTime, derived: nextDerived });

    for (let i = 0; i < 3; i++) {
      store.pushTrailPoint(i, {
        position: { ...nextBodies[i].position },
        timestamp: nextTime,
      });
    }
    store.pushGraphSample(nextTime, nextDerived);
  },
});
