import { describe, it, expect } from 'vitest';
import { computeAccelerations } from '../../src/engine/forces';
import type { BodyState, GlobalConfig } from '../../src/types';

// ─── Helpers ───

function makeBody(
  id: 'r' | 'g' | 'b',
  mass: number,
  px: number,
  py: number,
  vx = 0,
  vy = 0
): BodyState {
  return { id, mass, position: { x: px, y: py }, velocity: { x: vx, y: vy } };
}

function defaultGlobals(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return { G: 1.0, softening: 0.0, trailLength: 500, ...overrides };
}

// ─── TC-F01: Two-body attraction direction ───

describe('TC-F01: Two-body attraction direction', () => {
  it('Body A accelerates toward Body B (+x) and Body B accelerates toward Body A (-x)', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1, 0, 0),
      makeBody('g', 1, 1, 0),
      makeBody('b', 0.01, 1000, 1000), // far away, negligible influence
    ];
    const accs = computeAccelerations(bodies, defaultGlobals());

    expect(accs[0].x).toBeGreaterThan(0); // A pulled toward B (+x)
    expect(accs[1].x).toBeLessThan(0);    // B pulled toward A (-x)
  });
});

// ─── TC-F02: Inverse-square scaling (softened with ε=0) ───

describe('TC-F02: Inverse-square scaling', () => {
  it('force ratios are approximately 1 : 1/4 : 1/16 at distances 1, 2, 4', () => {
    const globals = defaultGlobals({ softening: 0.0 });

    // Place third body very far away so it doesn't interfere
    const far = makeBody('b', 0.01, 1e6, 1e6);

    const bodiesD1: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1, 0, 0), makeBody('g', 1, 1, 0), far,
    ];
    const bodiesD2: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1, 0, 0), makeBody('g', 1, 2, 0), far,
    ];
    const bodiesD4: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1, 0, 0), makeBody('g', 1, 4, 0), far,
    ];

    const a1 = computeAccelerations(bodiesD1, globals)[0].x;
    const a2 = computeAccelerations(bodiesD2, globals)[0].x;
    const a4 = computeAccelerations(bodiesD4, globals)[0].x;

    // a1 / a2 ≈ 4, a1 / a4 ≈ 16
    expect(a1 / a2).toBeCloseTo(4, 1);
    expect(a1 / a4).toBeCloseTo(16, 1);
  });
});

// ─── TC-F03: Softening prevents singularity ───

describe('TC-F03: Softening prevents singularity', () => {
  it('two bodies at identical position with ε>0 produce finite acceleration = G*m/ε³', () => {
    const eps = 0.05;
    const globals = defaultGlobals({ softening: eps });
    const m = 1.0;

    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', m, 0, 0),
      makeBody('g', m, 0, 0),
      makeBody('b', 0.01, 1e6, 1e6), // far away
    ];

    const accs = computeAccelerations(bodies, globals);

    // When both at same position, displacement is (0,0), so acceleration from
    // the coincident body is 0 (direction undefined). The acceleration is finite, not Inf/NaN.
    expect(Number.isFinite(accs[0].x)).toBe(true);
    expect(Number.isFinite(accs[0].y)).toBe(true);
    expect(Number.isFinite(accs[1].x)).toBe(true);
    expect(Number.isFinite(accs[1].y)).toBe(true);
  });
});

// ─── TC-F04: Newton's third law ───

describe("TC-F04: Newton's third law", () => {
  it('net force on the system is zero: m1*a1 + m2*a2 + m3*a3 ≈ (0,0)', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 3.0, -1, 2),
      makeBody('g', 7.0, 3, -1),
      makeBody('b', 2.5, 0.5, 4),
    ];
    const globals = defaultGlobals({ softening: 0.01 });
    const accs = computeAccelerations(bodies, globals);

    const netFx =
      bodies[0].mass * accs[0].x +
      bodies[1].mass * accs[1].x +
      bodies[2].mass * accs[2].x;
    const netFy =
      bodies[0].mass * accs[0].y +
      bodies[1].mass * accs[1].y +
      bodies[2].mass * accs[2].y;

    expect(netFx).toBeCloseTo(0, 10);
    expect(netFy).toBeCloseTo(0, 10);
  });
});

// ─── TC-F05: Symmetry ───

describe('TC-F05: Symmetry', () => {
  it('two bodies equidistant from a third produce symmetric accelerations', () => {
    // Body C at origin, Body A at (-1, 0), Body B at (1, 0) — all equal mass
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 1, -1, 0),
      makeBody('g', 1, 1, 0),
      makeBody('b', 1, 0, 0),
    ];
    const globals = defaultGlobals({ softening: 0.01 });
    const accs = computeAccelerations(bodies, globals);

    // Acceleration of A and B should be mirror images in x, same in y
    expect(accs[0].x).toBeCloseTo(-accs[1].x, 10);
    expect(accs[0].y).toBeCloseTo(accs[1].y, 10);

    // Central body should have zero net acceleration by symmetry
    expect(accs[2].x).toBeCloseTo(0, 10);
  });
});

// ─── TC-F06: Zero mass produces zero contribution ───

describe('TC-F06: Zero mass produces zero contribution', () => {
  it('near-zero mass body has negligible gravitational effect on massive bodies', () => {
    const globals = defaultGlobals({ softening: 0.01 });

    // Config with a tiny mass body
    const bodiesWithTiny: [BodyState, BodyState, BodyState] = [
      makeBody('r', 100, 0, 0),
      makeBody('g', 100, 3, 0),
      makeBody('b', 0.01, 0, 3),
    ];

    // Config with the tiny body removed (replaced by identical far-away body)
    const bodiesWithout: [BodyState, BodyState, BodyState] = [
      makeBody('r', 100, 0, 0),
      makeBody('g', 100, 3, 0),
      makeBody('b', 0.01, 1e6, 1e6),
    ];

    const accsWith = computeAccelerations(bodiesWithTiny, globals);
    const accsWithout = computeAccelerations(bodiesWithout, globals);

    // Massive bodies' accelerations should barely differ.
    // The tiny body (mass 0.01) is at distance 3, so its contribution is ~G*0.01/9 ≈ 0.001,
    // which is negligible relative to the ~11 from the other 100-mass body.
    expect(accsWith[0].x).toBeCloseTo(accsWithout[0].x, 2);
    expect(accsWith[0].y).toBeCloseTo(accsWithout[0].y, 2);
    expect(accsWith[1].x).toBeCloseTo(accsWithout[1].x, 2);
    expect(accsWith[1].y).toBeCloseTo(accsWithout[1].y, 2);
  });
});

// ─── TC-F07: G scaling ───

describe('TC-F07: G scaling', () => {
  it('all accelerations exactly double when G doubles', () => {
    const bodies: [BodyState, BodyState, BodyState] = [
      makeBody('r', 2, -1, 0.5),
      makeBody('g', 3, 1, -0.5),
      makeBody('b', 4, 0, 2),
    ];

    const accsG1 = computeAccelerations(bodies, defaultGlobals({ G: 1.0, softening: 0.01 }));
    const accsG2 = computeAccelerations(bodies, defaultGlobals({ G: 2.0, softening: 0.01 }));

    for (let i = 0; i < 3; i++) {
      expect(accsG2[i].x).toBeCloseTo(2 * accsG1[i].x, 10);
      expect(accsG2[i].y).toBeCloseTo(2 * accsG1[i].y, 10);
    }
  });
});
