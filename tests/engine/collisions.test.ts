import { describe, it, expect } from 'vitest';
import { detectCollisions, checkSeparation } from '../../src/engine/collisions';
import type { BodyState, BodyPair } from '../../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBody(
  id: 'r' | 'g' | 'b',
  mass: number,
  x: number, y: number,
  vx = 0, vy = 0
): BodyState {
  return { id, mass, position: { x, y }, velocity: { x: vx, y: vy } };
}

// Collision threshold: sum of cube-root-scaled radii × 2
// For mass 1: threshold = 4.0; for mass 10: threshold ≈ 9.28
const collisionThreshold = (massA: number, massB: number) =>
  (massA ** (1 / 3) + massB ** (1 / 3)) * 2;

// Separation threshold = 1.5× collision threshold
const separationThreshold = (massA: number, massB: number) =>
  collisionThreshold(massA, massB) * 1.5;

const NO_COOLDOWNS: Set<BodyPair> = new Set();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('detectCollisions', () => {
  // TC-C01: No collision when bodies are far apart
  it('TC-C01: no collision when all bodies are well separated', () => {
    // Min pairwise distance ≈ 7.07, threshold for mass-1 = 4.0
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, -5, 0),
      makeBody('g', 1.0,  5, 0),
      makeBody('b', 1.0,  0, 5),
    ];
    const events = detectCollisions(bodies, bodies, NO_COOLDOWNS, collisionThreshold);
    expect(events).toHaveLength(0);
  });

  // TC-C02: Collision detected when visual radii overlap
  it('TC-C02: collision event returned when bodies are within collision threshold', () => {
    // distance = 3.0 < threshold 4.0 for mass 1 → collision
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0),
      makeBody('g', 1.0, 3, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    const events = detectCollisions(bodies, bodies, NO_COOLDOWNS, collisionThreshold);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].pair).toBe('rg');
  });

  // TC-C03: Collision midpoint is correct
  it('TC-C03: collision midpoint is average of positions', () => {
    // Body A at (0,0), Body B at (2,0) → midpoint = (1,0)
    // distance=2 < threshold=4 → collision detected
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0),
      makeBody('g', 1.0, 2, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    const events = detectCollisions(bodies, bodies, NO_COOLDOWNS, collisionThreshold);
    const rgEvent = events.find(e => e.pair === 'rg');
    expect(rgEvent).toBeDefined();
    expect(rgEvent!.point.x).toBeCloseTo(1.0, 10);
    expect(rgEvent!.point.y).toBeCloseTo(0.0, 10);
  });

  // TC-C04: Relative speed calculation
  it('TC-C04: relative speed = 4.0 for head-on approach at (±0.5, 0) with velocities (±2, 0)', () => {
    // vA = (2,0), vB = (-2,0) → vA-vB = (4,0)
    // rA = (-0.5,0), rB = (0.5,0) → rA-rB = (-1,0), dist = 1
    // relSpeed = |(4,0)·(-1,0)| / 1 = 4.0
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, -0.5, 0,  2, 0),
      makeBody('g', 1.0,  0.5, 0, -2, 0),
      makeBody('b', 1.0, 50, 50,    0, 0),
    ];
    const events = detectCollisions(bodies, bodies, NO_COOLDOWNS, collisionThreshold);
    const rgEvent = events.find(e => e.pair === 'rg');
    expect(rgEvent).toBeDefined();
    expect(rgEvent!.relativeSpeed).toBeCloseTo(4.0, 10);
  });

  // TC-C05: Cooldown prevents re-triggering
  it('TC-C05: no event returned for pairs already in cooldown', () => {
    // Same close bodies as TC-C02, but rg is in cooldown
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0, 0),
      makeBody('g', 1.0, 3, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    const cooldowns: Set<BodyPair> = new Set(['rg']);
    const events = detectCollisions(bodies, bodies, cooldowns, collisionThreshold);
    expect(events.find(e => e.pair === 'rg')).toBeUndefined();
  });

  // TC-C08: Three-way collision produces correct pairs
  it('TC-C08: three-way collision returns events for rg, rb, gb', () => {
    // All three bodies at nearly the same position (distance ≈ 0.1 < threshold 4.0)
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0,  0.0, 0.0),
      makeBody('g', 1.0,  0.1, 0.0),
      makeBody('b', 1.0, -0.1, 0.0),
    ];
    const events = detectCollisions(bodies, bodies, NO_COOLDOWNS, collisionThreshold);
    const pairs = events.map(e => e.pair);
    expect(pairs).toContain('rg');
    expect(pairs).toContain('rb');
    expect(pairs).toContain('gb');
    expect(events).toHaveLength(3);
  });

  // TC-C09: Mass affects collision threshold
  it('TC-C09: heavier bodies have a larger collision threshold', () => {
    // Verify threshold function: mass 10 > mass 1
    const thresholdMass1 = collisionThreshold(1.0, 1.0);
    const thresholdMass10 = collisionThreshold(10.0, 10.0);
    expect(thresholdMass10).toBeGreaterThan(thresholdMass1);

    // Mass-1 bodies at distance 8 → no collision (threshold ≈ 4.0)
    const lightBodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0,  0, 0),
      makeBody('g', 1.0,  8, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    const lightEvents = detectCollisions(lightBodies, lightBodies, NO_COOLDOWNS, collisionThreshold);
    expect(lightEvents.find(e => e.pair === 'rg')).toBeUndefined();

    // Mass-10 bodies at same distance 8 → collision (threshold ≈ 9.28 > 8)
    const heavyBodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 10.0,  0, 0),
      makeBody('g', 10.0,  8, 0),
      makeBody('b', 10.0, 50, 50),
    ];
    const heavyEvents = detectCollisions(heavyBodies, heavyBodies, NO_COOLDOWNS, collisionThreshold);
    expect(heavyEvents.find(e => e.pair === 'rg')).toBeDefined();
  });
});

describe('checkSeparation', () => {
  // TC-C06: Separation clears cooldown (beyond 1.5× threshold)
  it('TC-C06: returns true when distance exceeds separation threshold', () => {
    // Collision threshold for mass 1 = 4.0, separation = 6.0
    // Place bodies at distance 6.1 > 6.0 → separated
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0,   0),
      makeBody('g', 1.0, 6.1, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    expect(checkSeparation(bodies, 'rg', separationThreshold)).toBe(true);
  });

  // TC-C07: Separation does NOT clear before 1.5× threshold
  it('TC-C07: returns false when distance is below separation threshold', () => {
    // Distance = 4.8 (1.2× collision threshold 4.0) < 6.0 separation threshold
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1.0, 0,   0),
      makeBody('g', 1.0, 4.8, 0),
      makeBody('b', 1.0, 50, 50),
    ];
    expect(checkSeparation(bodies, 'rg', separationThreshold)).toBe(false);
  });
});
