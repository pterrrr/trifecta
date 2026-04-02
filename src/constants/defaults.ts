import type { BodyState, GlobalConfig } from '../types/simulation';
import type { VisualFilters, DataVariable } from '../types/ui';

// ─── Default Body States ───

export const DEFAULT_BODY_R: BodyState = {
  id: 'r',
  mass: 1.0,
  position: { x: -1.0, y: 0.0 },
  velocity: { x: 0.0, y: 0.5 },
};

export const DEFAULT_BODY_G: BodyState = {
  id: 'g',
  mass: 1.0,
  position: { x: 1.0, y: 0.0 },
  velocity: { x: 0.0, y: -0.5 },
};

export const DEFAULT_BODY_B: BodyState = {
  id: 'b',
  mass: 1.0,
  position: { x: 0.0, y: 1.0 },
  velocity: { x: 0.0, y: 0.0 },
};

// ─── Default Global Config ───

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  G: 1.0,
  softening: 0.05,
  trailLength: 500,
};

// ─── Variable Ranges ───

export interface VariableRange {
  min: number;
  max: number;
}

export const BODY_VARIABLE_RANGES: Record<string, VariableRange> = {
  mass:     { min: 0.01,  max: 100.0 },
  positionX: { min: -10.0, max: 10.0  },
  positionY: { min: -10.0, max: 10.0  },
  velocityX: { min: -5.0,  max: 5.0   },
  velocityY: { min: -5.0,  max: 5.0   },
};

export const GLOBAL_VARIABLE_RANGES: Record<string, VariableRange> = {
  G:           { min: 0.01,  max: 10.0   },
  softening:   { min: 0.001, max: 1.0    },
  trailLength: { min: 50,    max: 2000   },
  simSpeed:    { min: 0.1,   max: 10.0   },
};

// ─── Default Visual Filters ───

export const DEFAULT_VISUAL_FILTERS: VisualFilters = {
  trails:               true,
  velocityVectors:      false,
  accelerationVectors:  false,
  distanceLines:        false,
  centerOfMass:         false,
  gravitationalField:   false,
  backgroundAnimation:  true,
};

// ─── Default Visible Data Variables ───

export const DEFAULT_VISIBLE_DATA_VARIABLES: Set<DataVariable> = new Set([
  'position',
  'speed',
  'totalEnergy',
]);
