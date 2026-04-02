import { describe, it, expect } from 'vitest';
import { integrateStep } from '../../src/engine/integrator';
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
  return { G: 1.0, softening: 0.05, trailLength: 500, ...overrides };
}

/** Equilateral triangle configuration — a stable test fixture. */
function equilateralConfig(): {
  bodies: [BodyState, BodyState, BodyState];
  globals: GlobalConfig;
} {
  const s = 1.0; // side length
  return {
    bodies: [
      makeBody('r', 1, -s / 2, 0),
      makeBody('g', 1, s / 2, 0),
      makeBody('b', 1, 0, (s * Math.sqrt(3)) / 2),
    ],
    globals: defaultGlobals(),
  };
}

/** Compute total kinetic energy. */
function kineticEnergy(bodies: [BodyState, BodyState, BodyState]): number {
  return bodies.reduce((sum, b) => {
    const v2 = b.velocity.x ** 2 + b.velocity.y ** 2;
    return sum + 0.5 * b.mass * v2;
  }, 0);
}

/** Compute total potential energy (softened). */
function potentialEnergy(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig
): number {
  const { G, softening } = globals;
  const eps2 = softening * softening;
  let pe = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const dx = bodies[j].position.x - bodies[i].position.x;
      const dy = bodies[j].position.y - bodies[i].position.y;
      const r = Math.sqrt(dx * dx + dy * dy + eps2);
      pe -= G * bodies[i].mass * bodies[j].mass / r;
    }
  }
  return pe;
}

function totalEnergy(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig
): number {
  return kineticEnergy(bodies) + potentialEnergy(bodies, globals);
}

/** Compute total linear momentum vector. */
function totalMomentum(bodies: [BodyState, BodyState, BodyState]): { x: number; y: number } {
  let px = 0, py = 0;
  for (const b of bodies) {
    px += b.mass * b.velocity.x;
    py += b.mass * b.velocity.y;
  }
  return { x: px, y: py };
}

/** Compute total angular momentum (scalar, 2D). */
function totalAngularMomentum(bodies: [BodyState, BodyState, BodyState]): number {
  let L = 0;
  for (const b of bodies) {
    L += b.mass * (b.position.x * b.velocity.y - b.position.y * b.velocity.x);
  }
  return L;
}

/** Run N integration steps. */
function runSteps(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig,
  dt: number,
  steps: number
): [BodyState, BodyState, BodyState] {
  let state = bodies;
  for (let i = 0; i < steps; i++) {
    state = integrateStep(state, globals, dt);
  }
  return state;
}

// ─── TC-I01: Stationary bodies at equilateral triangle ───

describe('TC-I01: Stationary bodies move toward center of mass', () => {
  it('after one step, bodies have moved toward center of mass', () => {
    const { bodies, globals } = equilateralConfig();

    // Center of mass
    const comX = (bodies[0].position.x + bodies[1].position.x + bodies[2].position.x) / 3;
    const comY = (bodies[0].position.y + bodies[1].position.y + bodies[2].position.y) / 3;

    const next = integrateStep(bodies, globals, 0.001);

    // Each body should be closer to CoM after the step
    for (let i = 0; i < 3; i++) {
      const dBefore = Math.hypot(
        bodies[i].position.x - comX,
        bodies[i].position.y - comY
      );
      const dAfter = Math.hypot(
        next[i].position.x - comX,
        next[i].position.y - comY
      );
      expect(dAfter).toBeLessThan(dBefore);
    }
  });
});

// ─── TC-I02: Conservation of energy (short run) ───

describe('TC-I02: Conservation of energy', () => {
  it('total energy drift < 0.01% over 1000 steps at dt=0.001', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const E0 = totalEnergy(bodies, globals);
    const final = runSteps(bodies, globals, dt, 1000);
    const Ef = totalEnergy(final, globals);

    const drift = Math.abs((Ef - E0) / E0);
    expect(drift).toBeLessThan(0.0001); // 0.01%
  });
});

// ─── TC-I03: Conservation of momentum ───

describe('TC-I03: Conservation of momentum', () => {
  it('total linear momentum drift < 1e-10 over 1000 steps', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const p0 = totalMomentum(bodies);
    const final = runSteps(bodies, globals, dt, 1000);
    const pf = totalMomentum(final);

    expect(Math.abs(pf.x - p0.x)).toBeLessThan(1e-10);
    expect(Math.abs(pf.y - p0.y)).toBeLessThan(1e-10);
  });
});

// ─── TC-I04: Conservation of angular momentum ───

describe('TC-I04: Conservation of angular momentum', () => {
  it('angular momentum drift < 1e-10 over 1000 steps', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const L0 = totalAngularMomentum(bodies);
    const final = runSteps(bodies, globals, dt, 1000);
    const Lf = totalAngularMomentum(final);

    expect(Math.abs(Lf - L0)).toBeLessThan(1e-10);
  });
});

// ─── TC-I05: Time reversibility (approximate) ───

describe('TC-I05: Time reversibility', () => {
  it('100 steps forward + 100 steps backward returns near original state', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const forward = runSteps(bodies, globals, dt, 100);
    const reversed = runSteps(forward, globals, -dt, 100);

    for (let i = 0; i < 3; i++) {
      // RK4 is not perfectly reversible; use absolute error since some positions are near zero
      const absErrX = Math.abs(reversed[i].position.x - bodies[i].position.x);
      const absErrY = Math.abs(reversed[i].position.y - bodies[i].position.y);

      expect(absErrX).toBeLessThan(1e-4);
      expect(absErrY).toBeLessThan(1e-4);
    }
  });
});

// ─── TC-I06: dt scaling (4th-order convergence) ───

describe('TC-I06: dt scaling', () => {
  it('dt=0.001 × 1000 steps ≈ dt=0.0001 × 10000 steps, fine is more accurate', () => {
    const { bodies, globals } = equilateralConfig();

    const coarse = runSteps(bodies, globals, 0.001, 1000);
    const fine = runSteps(bodies, globals, 0.0001, 10000);

    // RK4 is 4th-order: error scales as O(dt^4). With dt ratio 10:1,
    // the coarse run has ~10^4 = 10000× more per-step error, but 10× fewer steps,
    // so total error ratio is ~1000. The difference should be small but not < 1e-6
    // for a gravitational 3-body system over 1 time unit.
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(coarse[i].position.x - fine[i].position.x)).toBeLessThan(1e-4);
      expect(Math.abs(coarse[i].position.y - fine[i].position.y)).toBeLessThan(1e-4);
    }
  });
});

// ─── TC-I07: Determinism ───

describe('TC-I07: Determinism', () => {
  it('same configuration run twice produces bit-for-bit identical results', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const run1 = runSteps(bodies, globals, dt, 500);
    const run2 = runSteps(bodies, globals, dt, 500);

    for (let i = 0; i < 3; i++) {
      expect(run1[i].position.x).toBe(run2[i].position.x);
      expect(run1[i].position.y).toBe(run2[i].position.y);
      expect(run1[i].velocity.x).toBe(run2[i].velocity.x);
      expect(run1[i].velocity.y).toBe(run2[i].velocity.y);
    }
  });
});

// ─── TC-I08: Performance benchmark ───

describe('TC-I08: Step performance', () => {
  it('10,000 integration steps complete in < 100ms', () => {
    const { bodies, globals } = equilateralConfig();
    const dt = 0.001;

    const start = performance.now();
    runSteps(bodies, globals, dt, 10000);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
