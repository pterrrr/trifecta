import { describe, it, expect } from 'vitest';
import { computeDerived } from '../../src/engine/derived';
import type { BodyState, GlobalConfig } from '../../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBody(
  id: 'r' | 'g' | 'b',
  mass: number,
  x: number, y: number,
  vx: number, vy: number
): BodyState {
  return { id, mass, position: { x, y }, velocity: { x: vx, y: vy } };
}

const DEFAULT_GLOBALS: GlobalConfig = { G: 1.0, softening: 0.05, trailLength: 500 };

// Three non-degenerate bodies for generic tests
function makeGenericBodies(): [BodyState, BodyState, BodyState] {
  return [
    makeBody('r', 1.0, 0, 0, 1, 0),
    makeBody('g', 2.0, 3, 4, 0, 1),
    makeBody('b', 1.5, -2, 1, -1, -1),
  ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeDerived', () => {
  // TC-D01: Speed computation
  it('TC-D01: speed = |v| = 5 for velocity (3, 4)', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 3, 4),
      makeBody('g', 1.0, 10, 0, 0, 0),
      makeBody('b', 1.0, 0, 10, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.bodyDerived[0].speed).toBeCloseTo(5.0, 10);
  });

  // TC-D02: Kinetic energy
  it('TC-D02: KE = 0.5 * m * v² = 25 for mass 2, speed 5', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 2.0, 0, 0, 3, 4),
      makeBody('g', 1.0, 10, 0, 0, 0),
      makeBody('b', 1.0, 0, 10, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.bodyDerived[0].kineticEnergy).toBeCloseTo(25.0, 10);
  });

  // TC-D03: Pairwise distance (unsoftened Euclidean)
  it('TC-D03: distance between (0,0) and (3,4) = 5.0', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 0, 0),
      makeBody('g', 1.0, 3, 4, 0, 0),
      makeBody('b', 1.0, 10, 0, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.distances.rg).toBeCloseTo(5.0, 10);
  });

  // TC-D04: Potential energy (softened)
  it('TC-D04: PE_rg ≈ -1.99750 for masses 1, 2 at distance 1, G=1, ε=0.05', () => {
    // PE = -G * m1 * m2 / sqrt(d² + ε²) = -1*1*2 / sqrt(1 + 0.0025) ≈ -1.99750
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 0, 0),
      makeBody('g', 2.0, 1, 0, 0, 0),
      makeBody('b', 1.0, 100, 0, 0, 0),  // far away, negligible interaction
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    const expected = -1.0 * 2.0 / Math.sqrt(1.0 + 0.0025);
    expect(result.potentialEnergies.rg).toBeCloseTo(expected, 5);
  });

  // TC-D05: Total energy = sum of KE + PE
  it('TC-D05: totalEnergy = sum of all KE + sum of all PE', () => {
    const bodies = makeGenericBodies();
    const result = computeDerived(bodies, DEFAULT_GLOBALS);

    const expectedKE = result.bodyDerived[0].kineticEnergy
      + result.bodyDerived[1].kineticEnergy
      + result.bodyDerived[2].kineticEnergy;
    const expectedPE = result.potentialEnergies.rg
      + result.potentialEnergies.rb
      + result.potentialEnergies.gb;

    expect(result.totalEnergy).toBeCloseTo(expectedKE + expectedPE, 10);
  });

  // TC-D06: Center of mass
  it('TC-D06: CoM = (0.5, 1.0) for given masses and positions', () => {
    // Body A (m=1) at (0,0), Body B (m=1) at (2,0), Body C (m=2) at (0,2)
    // cx = (0 + 2 + 0) / 4 = 0.5
    // cy = (0 + 0 + 4) / 4 = 1.0
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 0, 0),
      makeBody('g', 1.0, 2, 0, 0, 0),
      makeBody('b', 2.0, 0, 2, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.centerOfMass.x).toBeCloseTo(0.5, 10);
    expect(result.centerOfMass.y).toBeCloseTo(1.0, 10);
  });

  // TC-D07: Total momentum
  it('TC-D07: totalMomentum = sum of m*v vectors', () => {
    // R: m=1, v=(2,0) → p=(2,0)
    // G: m=2, v=(0,3) → p=(0,6)
    // B: m=3, v=(-1,-1) → p=(-3,-3)
    // total: px = 2+0-3 = -1, py = 0+6-3 = 3
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 2, 0),
      makeBody('g', 2.0, 5, 0, 0, 3),
      makeBody('b', 3.0, 0, 5, -1, -1),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.totalMomentum.x).toBeCloseTo(-1.0, 10);
    expect(result.totalMomentum.y).toBeCloseTo(3.0, 10);
  });

  // TC-D08: Angular momentum
  it('TC-D08: L = 1.0 for mass-1 body at (1,0) with velocity (0,1)', () => {
    // L = m*(x*vy - y*vx) = 1*(1*1 - 0*0) = 1.0 for body R
    // Others at origin with zero velocity contribute 0
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 1, 0, 0, 1),
      makeBody('g', 1.0, 10, 0, 0, 0),
      makeBody('b', 1.0, 0, 10, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);
    expect(result.angularMomentum).toBeCloseTo(1.0, 10);
  });

  // TC-D09: All-zero velocities
  it('TC-D09: KE=0, speed=0, momentum=(0,0), angularMomentum=0 when all stationary', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0, 0, 0),
      makeBody('g', 1.0, 2, 0, 0, 0),
      makeBody('b', 1.0, -2, 0, 0, 0),
    ];
    const result = computeDerived(bodies, DEFAULT_GLOBALS);

    expect(result.bodyDerived[0].kineticEnergy).toBe(0);
    expect(result.bodyDerived[1].kineticEnergy).toBe(0);
    expect(result.bodyDerived[2].kineticEnergy).toBe(0);
    expect(result.bodyDerived[0].speed).toBe(0);
    expect(result.bodyDerived[1].speed).toBe(0);
    expect(result.bodyDerived[2].speed).toBe(0);
    expect(result.totalMomentum.x).toBe(0);
    expect(result.totalMomentum.y).toBe(0);
    expect(result.angularMomentum).toBe(0);

    // PE and total energy must be non-zero (bodies interact gravitationally)
    expect(result.potentialEnergies.rg).not.toBe(0);
    expect(result.totalEnergy).not.toBe(0);
  });
});
