import { describe, it, expect } from 'vitest';
import { encodeSeed } from '../../src/seed/encode';
import { decodeSeed } from '../../src/seed/decode';
import type { SimulationState } from '../../src/types/simulation';

/** Tolerance for float32 round-trip (±1e-6 relative, per TESTING.md §5.3). */
const FLOAT32_TOL = 1e-6;

function approxEqual(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  if (a === 0) return Math.abs(b) < FLOAT32_TOL;
  return Math.abs(a - b) / Math.abs(a) < FLOAT32_TOL;
}

function assertStateRoundTrips(original: SimulationState): void {
  const seed = encodeSeed(original);
  const decoded = decodeSeed(seed);

  expect(decoded).not.toBeNull();

  for (let i = 0; i < 3; i++) {
    const o = original.bodies[i];
    const d = decoded!.bodies[i];
    expect(approxEqual(o.mass, d.mass)).toBe(true);
    expect(approxEqual(o.position.x, d.position.x)).toBe(true);
    expect(approxEqual(o.position.y, d.position.y)).toBe(true);
    expect(approxEqual(o.velocity.x, d.velocity.x)).toBe(true);
    expect(approxEqual(o.velocity.y, d.velocity.y)).toBe(true);
  }

  expect(approxEqual(original.globals.G, decoded!.globals.G)).toBe(true);
  expect(approxEqual(original.globals.softening, decoded!.globals.softening)).toBe(true);
}

/** Generate a random float uniformly in [min, max]. */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomValidState(): SimulationState {
  return {
    bodies: [
      {
        id: 'r',
        mass: rand(0.01, 100.0),
        position: { x: rand(-10.0, 10.0), y: rand(-10.0, 10.0) },
        velocity: { x: rand(-5.0, 5.0),   y: rand(-5.0, 5.0) },
      },
      {
        id: 'g',
        mass: rand(0.01, 100.0),
        position: { x: rand(-10.0, 10.0), y: rand(-10.0, 10.0) },
        velocity: { x: rand(-5.0, 5.0),   y: rand(-5.0, 5.0) },
      },
      {
        id: 'b',
        mass: rand(0.01, 100.0),
        position: { x: rand(-10.0, 10.0), y: rand(-10.0, 10.0) },
        velocity: { x: rand(-5.0, 5.0),   y: rand(-5.0, 5.0) },
      },
    ],
    globals: {
      G: rand(0.01, 10.0),
      softening: rand(0.001, 1.0),
      trailLength: 500,
    },
    time: 0,
  };
}

// TC-S09: 100 randomly generated states round-trip
describe('TC-S09: random state round-trip fidelity', () => {
  it('100 randomly generated valid SimulationStates survive encode-decode within Float32 precision', () => {
    for (let i = 0; i < 100; i++) {
      assertStateRoundTrips(randomValidState());
    }
  });
});

// TC-S10: all presets round-trip (skipped until presetData.ts exists)
describe('TC-S10: preset round-trip fidelity', () => {
  it('default configuration state round-trips correctly', () => {
    const defaultState: SimulationState = {
      bodies: [
        { id: 'r', mass: 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x: 0.0, y: 0.5 } },
        { id: 'g', mass: 1.0, position: { x: 1.0, y: 0.0 },  velocity: { x: 0.0, y: -0.5 } },
        { id: 'b', mass: 1.0, position: { x: 0.0, y: 1.0 },  velocity: { x: 0.0, y: 0.0 } },
      ],
      globals: { G: 1.0, softening: 0.05, trailLength: 500 },
      time: 0,
    };
    assertStateRoundTrips(defaultState);
  });

  it('figure-eight-like symmetric state round-trips correctly', () => {
    const state: SimulationState = {
      bodies: [
        { id: 'r', mass: 1.0, position: { x: -0.97000436, y: 0.24308753 }, velocity: { x: 0.93240737 / 2, y: 0.86473146 / 2 } },
        { id: 'g', mass: 1.0, position: { x: 0.97000436, y: -0.24308753 }, velocity: { x: 0.93240737 / 2, y: 0.86473146 / 2 } },
        { id: 'b', mass: 1.0, position: { x: 0.0, y: 0.0 },                velocity: { x: -0.93240737,    y: -0.86473146 } },
      ],
      globals: { G: 1.0, softening: 0.05, trailLength: 500 },
      time: 0,
    };
    assertStateRoundTrips(state);
  });
});

// TC-S11: extreme values round-trip
describe('TC-S11: extreme values round-trip fidelity', () => {
  it('state with all values at their minimum bounds round-trips correctly', () => {
    const minState: SimulationState = {
      bodies: [
        { id: 'r', mass: 0.01, position: { x: -10.0, y: -10.0 }, velocity: { x: -5.0, y: -5.0 } },
        { id: 'g', mass: 0.01, position: { x: -10.0, y: -10.0 }, velocity: { x: -5.0, y: -5.0 } },
        { id: 'b', mass: 0.01, position: { x: -10.0, y: -10.0 }, velocity: { x: -5.0, y: -5.0 } },
      ],
      globals: { G: 0.01, softening: 0.001, trailLength: 500 },
      time: 0,
    };
    assertStateRoundTrips(minState);
  });

  it('state with all values at their maximum bounds round-trips correctly', () => {
    const maxState: SimulationState = {
      bodies: [
        { id: 'r', mass: 100.0, position: { x: 10.0, y: 10.0 }, velocity: { x: 5.0, y: 5.0 } },
        { id: 'g', mass: 100.0, position: { x: 10.0, y: 10.0 }, velocity: { x: 5.0, y: 5.0 } },
        { id: 'b', mass: 100.0, position: { x: 10.0, y: 10.0 }, velocity: { x: 5.0, y: 5.0 } },
      ],
      globals: { G: 10.0, softening: 1.0, trailLength: 500 },
      time: 0,
    };
    assertStateRoundTrips(maxState);
  });
});
