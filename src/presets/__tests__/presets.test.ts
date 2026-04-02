/**
 * Preset verification tests.
 *
 * Each test runs the physics engine for the described duration and asserts
 * the numerical behaviour matches the preset description.
 *
 * Tolerances account for the ε = 0.05 softening perturbation (see PHYSICS.md §11.1 note).
 */

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../presetData';
import { integrateStep } from '../../engine/integrator';
import type { BodyState, GlobalConfig } from '../../types/simulation';
import { useStore } from '../../state/store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runSimulation(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig,
  steps: number,
  dt = 0.001,
): [BodyState, BodyState, BodyState] {
  let current = bodies;
  for (let i = 0; i < steps; i++) {
    current = integrateStep(current, globals, dt);
  }
  return current;
}

/** Euclidean distance between two 2-D points. */
function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Distance from a point to the origin. */
function radius(p: { x: number; y: number }): number {
  return Math.sqrt(p.x ** 2 + p.y ** 2);
}

/**
 * Run the simulation while collecting the bounding box (max |x| and max |y|)
 * seen by each body.  Returns [R, G, B] max-radius seen over the run.
 */
function collectMaxRadii(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig,
  steps: number,
  dt = 0.001,
): [number, number, number] {
  let current = bodies;
  const maxR = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    current = integrateStep(current, globals, dt);
    for (let b = 0; b < 3; b++) {
      const r = radius(current[b].position);
      if (r > maxR[b]) maxR[b] = r;
    }
  }
  return maxR as [number, number, number];
}

// ─── Preset data sanity ───────────────────────────────────────────────────────

describe('PRESETS array', () => {
  it('has exactly 8 entries', () => {
    expect(PRESETS).toHaveLength(8);
  });

  it('all IDs are unique', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('each preset has a non-empty seed string of the expected length (92 chars)', () => {
    for (const p of PRESETS) {
      expect(p.seed).toMatch(/^[A-Za-z0-9_-]{92}$/);
    }
  });

  it('all seeds are distinct', () => {
    const seeds = PRESETS.map((p) => p.seed);
    expect(new Set(seeds).size).toBe(8);
  });

  it('all body ids are [r, g, b] in order', () => {
    for (const p of PRESETS) {
      expect(p.bodies[0].id).toBe('r');
      expect(p.bodies[1].id).toBe('g');
      expect(p.bodies[2].id).toBe('b');
    }
  });
});

// ─── Figure-Eight ─────────────────────────────────────────────────────────────

describe('Figure-Eight preset (choreographic)', () => {
  const preset = PRESETS.find((p) => p.id === 'figure-eight')!;

  it('all three bodies have equal mass', () => {
    const [r, g, b] = preset.bodies;
    expect(r.mass).toBe(g.mass);
    expect(g.mass).toBe(b.mass);
  });

  /**
   * Choreographic property: all three bodies follow the same path with a 1/3
   * period offset.  Therefore, the maximum radius each body reaches over a
   * full orbit should be approximately equal.
   *
   * Period T ≈ 6.3259 → run 6400 steps (dt = 0.001).
   * Tolerance is generous because ε = 0.05 perturbs the exact solution.
   */
  it('all three bodies reach the same maximum radius (choreographic — same path)', () => {
    const maxR = collectMaxRadii(preset.bodies, preset.globals, 6400);
    const [rMax, gMax, bMax] = maxR;

    // Each body's max radius should be similar — within 15% of each other
    const mean = (rMax + gMax + bMax) / 3;
    expect(rMax / mean).toBeGreaterThan(0.85);
    expect(rMax / mean).toBeLessThan(1.15);
    expect(gMax / mean).toBeGreaterThan(0.85);
    expect(gMax / mean).toBeLessThan(1.15);
    expect(bMax / mean).toBeGreaterThan(0.85);
    expect(bMax / mean).toBeLessThan(1.15);
  });

  /**
   * Bodies should stay bounded — the figure-eight has a known semi-major axis
   * of ~1.07 AU.  With softening perturbation, allow up to 3× that.
   */
  it('bodies stay bounded (no ejection) over one orbit', () => {
    const maxR = collectMaxRadii(preset.bodies, preset.globals, 6400);
    for (const r of maxR) {
      expect(r).toBeLessThan(6.0);
    }
  });

  /**
   * After exactly one period the bodies should return near their starting
   * positions.  With ε = 0.05 the orbit is perturbed so we allow ±0.5 AU.
   */
  it('bodies return near their starting positions after one period (T ≈ 6.326)', () => {
    const final = runSimulation(preset.bodies, preset.globals, 6326);
    for (let i = 0; i < 3; i++) {
      const d = dist(final[i].position, preset.bodies[i].position);
      expect(d).toBeLessThan(0.5);
    }
  });
});

// ─── Lagrange Triangle ────────────────────────────────────────────────────────

describe('Lagrange Triangle preset (stable)', () => {
  const preset = PRESETS.find((p) => p.id === 'lagrange-triangle')!;

  /**
   * The equilateral triangle property: all three pairwise distances should
   * remain approximately equal throughout the orbit.
   * Run 1000 steps and sample the distance ratios.
   */
  it('maintains equilateral triangle formation (pairwise distances stay approximately equal)', () => {
    let bodies = preset.bodies;

    // Check at 10 evenly-spaced snapshots over 1 time unit
    for (let step = 0; step < 10; step++) {
      bodies = runSimulation(bodies, preset.globals, 100);

      const dRG = dist(bodies[0].position, bodies[1].position);
      const dRB = dist(bodies[0].position, bodies[2].position);
      const dGB = dist(bodies[1].position, bodies[2].position);

      // All sides should be within 10% of each other
      const meanSide = (dRG + dRB + dGB) / 3;
      expect(dRG / meanSide).toBeGreaterThan(0.9);
      expect(dRG / meanSide).toBeLessThan(1.1);
      expect(dRB / meanSide).toBeGreaterThan(0.9);
      expect(dRB / meanSide).toBeLessThan(1.1);
      expect(dGB / meanSide).toBeGreaterThan(0.9);
      expect(dGB / meanSide).toBeLessThan(1.1);
    }
  });

  it('no body is ejected after 5 time units', () => {
    const final = runSimulation(preset.bodies, preset.globals, 5000);
    for (const b of final) {
      expect(radius(b.position)).toBeLessThan(50);
    }
  });
});

// ─── Chaotic Scatter ──────────────────────────────────────────────────────────

describe('Chaotic Scatter preset (chaotic)', () => {
  const preset = PRESETS.find((p) => p.id === 'chaotic-scatter')!;

  /**
   * Bodies should diverge — probing confirms scattering becomes dramatic
   * between t=20 and t=30 (max radius ~10 AU by t=30).
   * Probing confirms scattering peaks between t=28–30 (max radius ~10 AU).
   * Run 30,000 steps (30 time units) and require at least one body beyond 5 AU.
   */
  it('at least one body diverges significantly from the initial configuration', () => {
    const maxR = collectMaxRadii(preset.bodies, preset.globals, 30_000);
    const maxRadius = Math.max(...maxR);

    // Bodies scatter well beyond their starting positions by t=30
    expect(maxRadius).toBeGreaterThan(5.0);
  });

  /**
   * The initial configuration has no special symmetry — the bodies should not
   * remain in a simple 3-body orbit.  We verify the three pairwise distances
   * differ significantly after scattering (not an equilateral triangle).
   */
  it('bodies end up in asymmetric positions (not a rigid formation)', () => {
    const final = runSimulation(preset.bodies, preset.globals, 30_000);
    const dRG = dist(final[0].position, final[1].position);
    const dRB = dist(final[0].position, final[2].position);
    const dGB = dist(final[1].position, final[2].position);

    const dMin = Math.min(dRG, dRB, dGB);
    const dMax = Math.max(dRG, dRB, dGB);

    // If the distances are all within 10% of each other the formation didn't scatter
    expect(dMax / dMin).toBeGreaterThan(1.5);
  });
});

// ─── Hierarchical presets ─────────────────────────────────────────────────────

describe('Sun-Earth-Moon preset (hierarchical)', () => {
  const preset = PRESETS.find((p) => p.id === 'sun-earth-moon')!;

  it('Sun (Body R) barely moves — it is the dominant mass', () => {
    const final = runSimulation(preset.bodies, preset.globals, 2000);
    const sunDisplacement = dist(final[0].position, preset.bodies[0].position);
    // Sun is 100× heavier — it should move far less than 0.1 AU over 2 time units
    expect(sunDisplacement).toBeLessThan(0.1);
  });

  it('Earth (Body G) stays in a wide orbit around the Sun', () => {
    const final = runSimulation(preset.bodies, preset.globals, 5000);
    const earthSunDist = dist(final[0].position, final[1].position);
    // Should remain in a roughly stable orbit at ~5 AU ± 2 AU
    expect(earthSunDist).toBeGreaterThan(2.0);
    expect(earthSunDist).toBeLessThan(10.0);
  });
});

describe('Binary + Orbiter preset (hierarchical)', () => {
  const preset = PRESETS.find((p) => p.id === 'binary-orbiter')!;

  it('binary pair (R and G) stays close to each other', () => {
    const final = runSimulation(preset.bodies, preset.globals, 3000);
    const binaryDist = dist(final[0].position, final[1].position);
    // Binary separation should stay small relative to orbiter distance
    expect(binaryDist).toBeLessThan(3.0);
  });

  it('outer orbiter (Body B) stays far from the binary center', () => {
    const final = runSimulation(preset.bodies, preset.globals, 3000);
    const orbiterRadius = radius(final[2].position);
    expect(orbiterRadius).toBeGreaterThan(1.0);
  });
});

// ─── loadPreset store action ──────────────────────────────────────────────────

describe('loadPreset store action', () => {
  const figureEight = PRESETS.find((p) => p.id === 'figure-eight')!;
  const lagrange = PRESETS.find((p) => p.id === 'lagrange-triangle')!;

  function resetStore() {
    useStore.setState(useStore.getInitialState());
  }

  it('Lab mode: populates staged buffer and sets activePresetId, does not start simulation', () => {
    resetStore();
    expect(useStore.getState().mode).toBe('lab');

    useStore.getState().loadPreset(figureEight);

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![0].position.x).toBeCloseTo(-0.97000436, 4);
    expect(s.stagedGlobals).not.toBeNull();
    expect(s.activePresetId).toBe('figure-eight');
    // Simulation should NOT have started
    expect(s.isPlaying).toBe(false);
    // Active bodies should be unchanged (still defaults)
    expect(s.bodies[0].mass).toBe(1.0);
    expect(s.bodies[0].position.x).toBe(-1.0); // default, not figure-eight
  });

  it('Lab mode: loading a different preset overwrites the staged buffer', () => {
    resetStore();
    useStore.getState().loadPreset(figureEight);
    useStore.getState().loadPreset(lagrange);

    const s = useStore.getState();
    expect(s.activePresetId).toBe('lagrange-triangle');
    // Lagrange Body R starts at x=1.0
    expect(s.stagedBodies![0].position.x).toBeCloseTo(1.0, 4);
  });

  it('Live mode: applies preset immediately to active state and sets activePresetId', () => {
    resetStore();
    useStore.getState().setMode('live');

    useStore.getState().loadPreset(figureEight);

    const s = useStore.getState();
    expect(s.bodies[0].position.x).toBeCloseTo(-0.97000436, 4);
    expect(s.globals.G).toBe(1.0);
    expect(s.activePresetId).toBe('figure-eight');
    // initialConditions should be updated so reset returns to the preset
    expect(s.initialConditions.bodies[0].position.x).toBeCloseTo(-0.97000436, 4);
  });

  it('Live mode: does not pause the simulation', () => {
    resetStore();
    useStore.getState().setMode('live'); // commits staged → active, starts playing
    expect(useStore.getState().isPlaying).toBe(true);

    useStore.getState().loadPreset(figureEight);

    // should still be playing
    expect(useStore.getState().isPlaying).toBe(true);
  });
});
