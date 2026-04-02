import type { StateCreator } from 'zustand';
import type { TrailPoint, TrailHistory, SystemDerived } from '../../types';
import type { TrifectaStore } from '../store';

const MAX_GRAPH_SAMPLES = 3000;

export interface GraphSample {
  time: number;
  // Per-body values
  speedR: number;
  speedG: number;
  speedB: number;
  keR: number;
  keG: number;
  keB: number;
  // Pairwise
  distRG: number;
  distRB: number;
  distGB: number;
  peRG: number;
  peRB: number;
  peGB: number;
  // System
  totalEnergy: number;
  angularMomentum: number;
}

export interface HistorySlice {
  trailHistory: TrailHistory;
  graphHistory: GraphSample[];

  pushTrailPoint: (bodyIndex: number, point: TrailPoint) => void;
  pushAllTrailPoints: (points: [TrailPoint, TrailPoint, TrailPoint]) => void;
  pushGraphSample: (time: number, derived: SystemDerived) => void;
  clearTrails: () => void;
  clearGraphHistory: () => void;
}

export const createHistorySlice: StateCreator<
  TrifectaStore,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  trailHistory: [[], [], []] as TrailHistory,
  graphHistory: [],

  pushTrailPoint: (bodyIndex, point) => {
    const { trailHistory, globals } = get();
    const trail = trailHistory[bodyIndex];
    trail.push(point);

    // Trim to trailLength
    const maxLen = globals.trailLength;
    if (trail.length > maxLen) {
      trail.splice(0, trail.length - maxLen);
    }

    // Mutate in place — trigger re-render via a new array reference at the top level
    set({ trailHistory: [trailHistory[0], trailHistory[1], trailHistory[2]] });
  },

  pushAllTrailPoints: (points) => {
    const { trailHistory, globals } = get();
    const maxLen = globals.trailLength;

    // Update all 3 bodies in one pass, then emit a single set() — avoids 3×
    // Zustand notification cycles per frame that pushTrailPoint would cause.
    for (let i = 0; i < 3; i++) {
      const trail = trailHistory[i];
      trail.push(points[i]);
      if (trail.length > maxLen) {
        trail.splice(0, trail.length - maxLen);
      }
    }

    set({ trailHistory: [trailHistory[0], trailHistory[1], trailHistory[2]] });
  },

  pushGraphSample: (time, derived) => {
    const { graphHistory } = get();

    const sample: GraphSample = {
      time,
      speedR: derived.bodyDerived[0].speed,
      speedG: derived.bodyDerived[1].speed,
      speedB: derived.bodyDerived[2].speed,
      keR: derived.bodyDerived[0].kineticEnergy,
      keG: derived.bodyDerived[1].kineticEnergy,
      keB: derived.bodyDerived[2].kineticEnergy,
      distRG: derived.distances.rg,
      distRB: derived.distances.rb,
      distGB: derived.distances.gb,
      peRG: derived.potentialEnergies.rg,
      peRB: derived.potentialEnergies.rb,
      peGB: derived.potentialEnergies.gb,
      totalEnergy: derived.totalEnergy,
      angularMomentum: derived.angularMomentum,
    };

    graphHistory.push(sample);

    // Rolling buffer cap
    if (graphHistory.length > MAX_GRAPH_SAMPLES) {
      graphHistory.splice(0, graphHistory.length - MAX_GRAPH_SAMPLES);
    }

    set({ graphHistory });
  },

  clearTrails: () => set({ trailHistory: [[], [], []] }),

  clearGraphHistory: () => set({ graphHistory: [] }),
});
