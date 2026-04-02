import type { StateCreator } from 'zustand';
import type {
  BodyId,
  BodyState,
  GlobalConfig,
  SimulationState,
  SystemDerived,
  Vector2D,
} from '../../types';
import {
  DEFAULT_BODY_R,
  DEFAULT_BODY_G,
  DEFAULT_BODY_B,
  DEFAULT_GLOBAL_CONFIG,
} from '../../constants';
import type { TrifectaStore } from '../store';
import type { Preset } from '../../types/presets';
import { computeDerived } from '../../engine/derived';

// ─── Slice State & Actions ───

export interface SimulationSlice {
  bodies: [BodyState, BodyState, BodyState];
  globals: GlobalConfig;
  time: number;
  initialConditions: SimulationState;
  derived: SystemDerived;

  setBodyProperty: (
    id: BodyId,
    property: keyof BodyState,
    value: number | Vector2D,
  ) => void;
  setGlobal: (property: keyof GlobalConfig, value: number) => void;
  applyNextState: (next: SimulationState) => void;
  snapshotInitialConditions: () => void;
  loadPreset: (preset: Preset) => void;
  loadSeed: (state: SimulationState) => void;
  randomReset: () => void;
}

// ─── Defaults ───

const defaultBodies: [BodyState, BodyState, BodyState] = [
  { ...DEFAULT_BODY_R, position: { ...DEFAULT_BODY_R.position }, velocity: { ...DEFAULT_BODY_R.velocity } },
  { ...DEFAULT_BODY_G, position: { ...DEFAULT_BODY_G.position }, velocity: { ...DEFAULT_BODY_G.velocity } },
  { ...DEFAULT_BODY_B, position: { ...DEFAULT_BODY_B.position }, velocity: { ...DEFAULT_BODY_B.velocity } },
];

const defaultGlobals: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG };

const defaultDerived: SystemDerived = {
  bodyDerived: [
    { speed: 0, acceleration: { x: 0, y: 0 }, kineticEnergy: 0 },
    { speed: 0, acceleration: { x: 0, y: 0 }, kineticEnergy: 0 },
    { speed: 0, acceleration: { x: 0, y: 0 }, kineticEnergy: 0 },
  ],
  distances: { rg: 0, rb: 0, gb: 0 },
  potentialEnergies: { rg: 0, rb: 0, gb: 0 },
  totalEnergy: 0,
  angularMomentum: 0,
  centerOfMass: { x: 0, y: 0 },
  totalMomentum: { x: 0, y: 0 },
};

function cloneBodies(
  bodies: [BodyState, BodyState, BodyState],
): [BodyState, BodyState, BodyState] {
  return bodies.map((b) => ({
    ...b,
    position: { ...b.position },
    velocity: { ...b.velocity },
  })) as [BodyState, BodyState, BodyState];
}

// ─── Slice Creator ───

export const createSimulationSlice: StateCreator<
  TrifectaStore,
  [],
  [],
  SimulationSlice
> = (set, get) => ({
  bodies: cloneBodies(defaultBodies),
  globals: { ...defaultGlobals },
  time: 0,
  initialConditions: {
    bodies: cloneBodies(defaultBodies),
    globals: { ...defaultGlobals },
    time: 0,
  },
  derived: defaultDerived,

  setBodyProperty: (id, property, value) => {
    set((state) => {
      const idx = state.bodies.findIndex((b) => b.id === id);
      if (idx === -1) return state;

      const newBodies = cloneBodies(state.bodies);
      (newBodies[idx] as unknown as Record<string, unknown>)[property] = value;

      return { bodies: newBodies, activePresetId: null };
    });
  },

  setGlobal: (property, value) => {
    set((state) => ({
      globals: { ...state.globals, [property]: value },
      activePresetId: null,
    }));
  },

  applyNextState: (next) => {
    set({
      bodies: next.bodies,
      globals: next.globals,
      time: next.time,
    });
  },

  snapshotInitialConditions: () => {
    const { bodies, globals, time } = get();
    set({
      initialConditions: {
        bodies: cloneBodies(bodies),
        globals: { ...globals },
        time,
      },
    });
  },

  loadPreset: (preset: Preset) => {
    const newBodies = cloneBodies(preset.bodies);
    const newGlobals = { ...preset.globals };
    const newState: SimulationState = { bodies: newBodies, globals: newGlobals, time: 0 };

    if (get().mode === 'lab') {
      // Populate staged buffer — do not auto-start
      set({
        stagedBodies: newState.bodies,
        stagedGlobals: newState.globals,
        activePresetId: preset.id,
      });
    } else {
      // Live mode: apply immediately, continue from current time
      set({
        bodies: newState.bodies,
        globals: newState.globals,
        initialConditions: newState,
        activePresetId: preset.id,
        derived: computeDerived(newState.bodies, newState.globals),
      });
    }
  },

  loadSeed: (decoded: SimulationState) => {
    const newBodies = cloneBodies(decoded.bodies);
    const newGlobals = { ...decoded.globals, trailLength: get().globals.trailLength };

    if (get().mode === 'lab') {
      set({
        stagedBodies: newBodies,
        stagedGlobals: newGlobals,
        activePresetId: null,
      });
    } else {
      const newState: SimulationState = { bodies: newBodies, globals: newGlobals, time: 0 };
      set({
        bodies: newBodies,
        globals: newGlobals,
        initialConditions: newState,
        activePresetId: null,
        derived: computeDerived(newBodies, newGlobals),
      });
    }
  },

  randomReset: () => {
    // §9.1: sample from "interesting" subranges, not full min-max
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const ids: BodyId[] = ['r', 'g', 'b'];
    const newBodies = ids.map((id) => ({
      id,
      mass: rand(0.5, 5.0),
      position: { x: rand(-3.0, 3.0), y: rand(-3.0, 3.0) },
      velocity: { x: rand(-1.5, 1.5), y: rand(-1.5, 1.5) },
    })) as [BodyState, BodyState, BodyState];

    if (get().mode === 'lab') {
      // Lab Mode: populate staged buffer, do not auto-start
      set({ stagedBodies: newBodies, activePresetId: null });
    } else {
      // Live Mode: apply immediately, keep running, don't clear trails
      const globals = get().globals;
      set({
        bodies: newBodies,
        activePresetId: null,
        derived: computeDerived(newBodies, globals),
        initialConditions: {
          bodies: cloneBodies(newBodies),
          globals: { ...globals },
          time: 0,
        },
      });
    }
  },
});
