import type { StateCreator } from 'zustand';
import type { BodyId, BodyState, GlobalConfig, Vector2D } from '../../types';
import type { TrifectaStore } from '../store';

export interface StagedSlice {
  stagedBodies: [BodyState, BodyState, BodyState] | null;
  stagedGlobals: GlobalConfig | null;

  setStagedBodyProperty: (
    id: BodyId,
    property: keyof BodyState,
    value: number | Vector2D,
  ) => void;
  setStagedGlobal: (property: keyof GlobalConfig, value: number) => void;
  commitStaged: () => void;
  snapshotToStaged: () => void;
  /** Lab Mode drag: update both staged buffer and active bodies for immediate visual feedback. */
  dragBodyPosition: (id: BodyId, position: Vector2D) => void;
}

function cloneBodies(
  bodies: [BodyState, BodyState, BodyState],
): [BodyState, BodyState, BodyState] {
  return bodies.map((b) => ({
    ...b,
    position: { ...b.position },
    velocity: { ...b.velocity },
  })) as [BodyState, BodyState, BodyState];
}

export const createStagedSlice: StateCreator<
  TrifectaStore,
  [],
  [],
  StagedSlice
> = (set, get) => ({
  stagedBodies: null,
  stagedGlobals: null,

  setStagedBodyProperty: (id, property, value) => {
    set((state) => {
      const staged = state.stagedBodies
        ? cloneBodies(state.stagedBodies)
        : cloneBodies(state.bodies);

      const idx = staged.findIndex((b) => b.id === id);
      if (idx === -1) return state;

      (staged[idx] as unknown as Record<string, unknown>)[property] = value;
      return { stagedBodies: staged, activePresetId: null };
    });
  },

  setStagedGlobal: (property, value) => {
    set((state) => {
      const globals = state.stagedGlobals
        ? { ...state.stagedGlobals }
        : { ...state.globals };
      (globals as Record<string, unknown>)[property] = value;
      return { stagedGlobals: globals, activePresetId: null };
    });
  },

  commitStaged: () => {
    const state = get();
    const bodies = state.stagedBodies
      ? cloneBodies(state.stagedBodies)
      : cloneBodies(state.bodies);
    const globals = state.stagedGlobals
      ? { ...state.stagedGlobals }
      : { ...state.globals };

    set({
      bodies,
      globals,
      time: 0,
      isPlaying: true,
    });

    // Snapshot so reset returns to these committed conditions
    get().snapshotInitialConditions();

    // Clear trails and graph for fresh run
    get().clearTrails();
    get().clearGraphHistory();
  },

  snapshotToStaged: () => {
    const { bodies, globals } = get();
    set({
      stagedBodies: cloneBodies(bodies),
      stagedGlobals: { ...globals },
    });
  },

  dragBodyPosition: (id, position) => {
    set((state) => {
      // Update staged buffer (create from active if staged not yet initialized)
      const staged = state.stagedBodies
        ? cloneBodies(state.stagedBodies)
        : cloneBodies(state.bodies);
      const stagedIdx = staged.findIndex((b) => b.id === id);
      if (stagedIdx !== -1) {
        staged[stagedIdx] = { ...staged[stagedIdx], position: { ...position } };
      }

      // Also update active bodies so the canvas reflects the drag immediately
      const bodies = cloneBodies(state.bodies);
      const bodyIdx = bodies.findIndex((b) => b.id === id);
      if (bodyIdx !== -1) {
        bodies[bodyIdx] = { ...bodies[bodyIdx], position: { ...position } };
      }

      return { stagedBodies: staged, bodies };
    });
  },
});
