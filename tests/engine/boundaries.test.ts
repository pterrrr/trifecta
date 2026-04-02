import { describe, it, expect } from 'vitest';
import { detectEjections, checkEnergyDrift } from '../../src/engine/boundaries';
import { HARD_BOUNDARY, ENERGY_DRIFT_WARNING } from '../../src/constants/physics';
import type { BodyState } from '../../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBody(
  id: 'r' | 'g' | 'b',
  x: number,
  y: number
): BodyState {
  return { id, mass: 1.0, position: { x, y }, velocity: { x: 0, y: 0 } };
}

// ─── detectEjections ─────────────────────────────────────────────────────────

describe('detectEjections', () => {
  // TC-B01: No ejection within bounds
  it('TC-B01: returns empty array when all bodies are within bounds', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r',   0,   0),
      makeBody('g',  50,  50),
      makeBody('b', -50, -50),
    ];
    expect(detectEjections(bodies, HARD_BOUNDARY)).toHaveLength(0);
  });

  // TC-B02: Ejection detected at hard boundary
  it('TC-B02: returns body ID when |x| exceeds HARD_BOUNDARY', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1001, 0),
      makeBody('g',    0, 0),
      makeBody('b',    0, 0),
    ];
    const ejected = detectEjections(bodies, HARD_BOUNDARY);
    expect(ejected).toContain('r');
    expect(ejected).toHaveLength(1);
  });

  // TC-B03: Multiple ejections
  it('TC-B03: returns both IDs when two bodies are beyond boundary', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1001,    0),
      makeBody('g', -1500,   0),
      makeBody('b',    0,    0),
    ];
    const ejected = detectEjections(bodies, HARD_BOUNDARY);
    expect(ejected).toContain('r');
    expect(ejected).toContain('g');
    expect(ejected).toHaveLength(2);
  });

  // TC-B04: Negative coordinates count
  it('TC-B04: ejection triggered by |x| > boundary (negative x)', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', -1001, 500),
      makeBody('g',     0,   0),
      makeBody('b',     0,   0),
    ];
    const ejected = detectEjections(bodies, HARD_BOUNDARY);
    expect(ejected).toContain('r');
  });
});

// ─── checkEnergyDrift ────────────────────────────────────────────────────────

describe('checkEnergyDrift', () => {
  // TC-B05: No drift — same energy
  it('TC-B05: returns false when energy has not drifted', () => {
    expect(checkEnergyDrift(-5.0, -5.0, ENERGY_DRIFT_WARNING)).toBe(false);
  });

  // TC-B06: Drift within tolerance (8% < 10%)
  it('TC-B06: returns false for 8% relative drift (under 10% threshold)', () => {
    // |(-4.6) - (-5.0)| / |-5.0| = 0.4/5.0 = 0.08 < 0.10
    expect(checkEnergyDrift(-4.6, -5.0, ENERGY_DRIFT_WARNING)).toBe(false);
  });

  // TC-B07: Drift exceeds tolerance (12% > 10%)
  it('TC-B07: returns true for 12% relative drift (over 10% threshold)', () => {
    // |(-4.4) - (-5.0)| / |-5.0| = 0.6/5.0 = 0.12 > 0.10
    expect(checkEnergyDrift(-4.4, -5.0, ENERGY_DRIFT_WARNING)).toBe(true);
  });

  // TC-B08: Near-zero initial energy uses absolute threshold
  it('TC-B08: uses absolute threshold when initial energy is near zero', () => {
    // initialEnergy = 0.001 (< ENERGY_DRIFT_ABSOLUTE = 1.0)
    // currentEnergy = 1.5 → |1.5 - 0.001| = 1.499 > 1.0 → true
    expect(checkEnergyDrift(1.5, 0.001, ENERGY_DRIFT_WARNING)).toBe(true);
  });
});
