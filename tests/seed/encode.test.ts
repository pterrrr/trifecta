import { describe, it, expect } from 'vitest';
import { encodeSeed } from '../../src/seed/encode';
import type { SimulationState } from '../../src/types/simulation';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function makeState(overrides: Partial<{
  rMass: number; gMass: number; bMass: number;
}>  = {}): SimulationState {
  return {
    bodies: [
      { id: 'r', mass: overrides.rMass ?? 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x: 0.0, y: 0.5 } },
      { id: 'g', mass: overrides.gMass ?? 1.0, position: { x: 1.0, y: 0.0 },  velocity: { x: 0.0, y: -0.5 } },
      { id: 'b', mass: overrides.bMass ?? 1.0, position: { x: 0.0, y: 1.0 },  velocity: { x: 0.0, y: 0.0 } },
    ],
    globals: { G: 1.0, softening: 0.05, trailLength: 500 },
    time: 0,
  };
}

// TC-S01: output format
describe('TC-S01: encodeSeed output format', () => {
  it('produces exactly 92 characters', () => {
    expect(encodeSeed(makeState())).toHaveLength(92);
  });

  it('contains only valid Base64url characters (no +, /, =)', () => {
    const seed = encodeSeed(makeState());
    expect(BASE64URL_RE.test(seed)).toBe(true);
  });

  it('contains no padding character =', () => {
    const seed = encodeSeed(makeState());
    expect(seed).not.toContain('=');
  });
});

// TC-S02: determinism
describe('TC-S02: encodeSeed determinism', () => {
  it('returns identical strings for the same state called twice', () => {
    const state = makeState();
    expect(encodeSeed(state)).toBe(encodeSeed(state));
  });

  it('returns identical strings for two structurally equal state objects', () => {
    expect(encodeSeed(makeState())).toBe(encodeSeed(makeState()));
  });
});

// TC-S03: different states → different seeds
describe('TC-S03: different states produce different seeds', () => {
  it('states differing by 0.001 in one mass value produce different seeds', () => {
    const seedA = encodeSeed(makeState({ rMass: 1.000 }));
    const seedB = encodeSeed(makeState({ rMass: 1.001 }));
    expect(seedA).not.toBe(seedB);
  });

  it('states differing in position produce different seeds', () => {
    const stateA: SimulationState = {
      bodies: [
        { id: 'r', mass: 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x: 0.0, y: 0.5 } },
        { id: 'g', mass: 1.0, position: { x: 1.0, y: 0.0 },  velocity: { x: 0.0, y: -0.5 } },
        { id: 'b', mass: 1.0, position: { x: 0.0, y: 1.0 },  velocity: { x: 0.0, y: 0.0 } },
      ],
      globals: { G: 1.0, softening: 0.05, trailLength: 500 },
      time: 0,
    };
    const stateB: SimulationState = {
      ...stateA,
      bodies: [
        { id: 'r', mass: 1.0, position: { x: -1.001, y: 0.0 }, velocity: { x: 0.0, y: 0.5 } },
        stateA.bodies[1],
        stateA.bodies[2],
      ],
    };
    expect(encodeSeed(stateA)).not.toBe(encodeSeed(stateB));
  });

  it('states differing in G produce different seeds', () => {
    const stateA = makeState();
    const stateB: SimulationState = {
      ...stateA,
      globals: { ...stateA.globals, G: 1.001 },
    };
    expect(encodeSeed(stateA)).not.toBe(encodeSeed(stateB));
  });
});
