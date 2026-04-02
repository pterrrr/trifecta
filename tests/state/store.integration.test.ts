/**
 * Integration Tests: Simulation Loop (TC-L01 – TC-L07)
 * See specs/TESTING.md §10
 *
 * Tests the full pipeline: engine → state → history.
 * No canvas rendering — we verify data flow only.
 *
 * Strategy: call processSimulationFrame() directly, which runs the same physics
 * + store-update logic the rAF loop uses, but without DOM/canvas dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';
import {
  processSimulationFrame,
  type FrameRefs,
} from '../../src/hooks/useSimulationLoop';
import { MAX_STEPS_PER_FRAME } from '../../src/constants/physics';
import type { BodyState } from '../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore() {
  useStore.setState(useStore.getInitialState());
  // getInitialState() returns references to the original trail/graph arrays, which
  // pushTrailPoint mutates in-place. Force-create fresh arrays so cross-test
  // contamination doesn't accumulate.
  useStore.getState().clearTrails();
  useStore.getState().clearGraphHistory();
}

function makeRefs(): FrameRefs {
  return { accumulator: 0, lastGraphUpdate: 0, cachedInitialEnergy: null };
}

/** Wall-clock duration of one frame at 60 fps (ms). */
const FRAME_MS = 1000 / 60; // ≈16.67 ms

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Integration Tests: Simulation Loop (TC-L01 – TC-L07)', () => {
  beforeEach(resetStore);

  // ── TC-L01 ────────────────────────────────────────────────────────────────

  it('TC-L01: one frame produces a state update (positions change, time advances)', () => {
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();

    const initialPositions = useStore
      .getState()
      .bodies.map((b) => ({ x: b.position.x, y: b.position.y }));
    const refs = makeRefs();

    processSimulationFrame(FRAME_MS, FRAME_MS, refs);

    const s = useStore.getState();
    const moved = s.bodies.some(
      (b, i) =>
        b.position.x !== initialPositions[i].x ||
        b.position.y !== initialPositions[i].y,
    );
    expect(moved).toBe(true);
    expect(s.time).toBeGreaterThan(0);
  });

  // ── TC-L02 ────────────────────────────────────────────────────────────────

  it('TC-L02: trail history accumulates — 10 frames → 10 trail points per body', () => {
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();

    const refs = makeRefs();
    for (let i = 0; i < 10; i++) {
      processSimulationFrame(FRAME_MS, (i + 1) * FRAME_MS, refs);
    }

    const { trailHistory } = useStore.getState();
    expect(trailHistory[0].length).toBe(10);
    expect(trailHistory[1].length).toBe(10);
    expect(trailHistory[2].length).toBe(10);
  });

  // ── TC-L03 ────────────────────────────────────────────────────────────────

  it('TC-L03: graph history respects 10Hz throttle (~6 frames at 60fps → ≤2 samples)', () => {
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();

    const refs = makeRefs();
    // ~100ms at 60fps ≈ 6 frames; 10Hz throttle allows at most 1 sample per 100ms
    for (let i = 0; i < 6; i++) {
      processSimulationFrame(FRAME_MS, (i + 1) * FRAME_MS, refs);
    }

    const { graphHistory } = useStore.getState();
    expect(graphHistory.length).toBeLessThanOrEqual(2);
  });

  // ── TC-L04 ────────────────────────────────────────────────────────────────

  it('TC-L04: paused simulation does not advance physics, trails, or time', () => {
    useStore.getState().snapshotInitialConditions();
    // isPlaying starts false — do NOT call play()

    const initialPositions = useStore
      .getState()
      .bodies.map((b) => ({ x: b.position.x, y: b.position.y }));
    const refs = makeRefs();

    for (let i = 0; i < 10; i++) {
      processSimulationFrame(FRAME_MS, (i + 1) * FRAME_MS, refs);
    }

    const s = useStore.getState();
    s.bodies.forEach((b, i) => {
      expect(b.position.x).toBe(initialPositions[i].x);
      expect(b.position.y).toBe(initialPositions[i].y);
    });
    expect(s.time).toBe(0);
    expect(s.trailHistory[0].length).toBe(0);
    expect(s.trailHistory[1].length).toBe(0);
    expect(s.trailHistory[2].length).toBe(0);
  });

  // ── TC-L05 ────────────────────────────────────────────────────────────────

  it('TC-L05: speed multiplier scales step count proportionally (5× speed → ~5× steps)', () => {
    // Use a short wallElapsed so neither run hits MAX_STEPS_PER_FRAME.
    // At 3ms wall, speed 1: stepsNeeded ≈ 3; speed 5: stepsNeeded ≈ 15 (both < 20).
    const WALL_MS = 3;

    // ── Speed 1× ──
    resetStore();
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();
    useStore.getState().setSpeed(1);
    const { stepsExecuted: steps1 } = processSimulationFrame(WALL_MS, WALL_MS, makeRefs());

    // ── Speed 5× ──
    resetStore();
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();
    useStore.getState().setSpeed(5);
    const { stepsExecuted: steps5 } = processSimulationFrame(WALL_MS, WALL_MS, makeRefs());

    expect(steps5).toBeGreaterThan(steps1);
    // Allow ±1 step tolerance (rounding at accumulator boundary)
    expect(Math.abs(steps5 - steps1 * 5)).toBeLessThanOrEqual(1);
  });

  // ── TC-L06 ────────────────────────────────────────────────────────────────

  it('TC-L06: MAX_STEPS_PER_FRAME caps physics steps even at high speed/elapsed', () => {
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();
    useStore.getState().setSpeed(10);

    // 100ms wall at 10× speed → 1000 steps needed → must be capped at MAX_STEPS_PER_FRAME
    const refs = makeRefs();
    const { stepsExecuted } = processSimulationFrame(100, 100, refs);

    expect(stepsExecuted).toBe(MAX_STEPS_PER_FRAME);
  });

  // ── TC-L07 ────────────────────────────────────────────────────────────────

  it('TC-L07: collision detection feeds into activeCollisions state', () => {
    // Collision threshold for mass-1 bodies: 0.02 × (∛1 + ∛1) = 0.04 AU
    // Place R at (0,0) and G at (0.01, 0) — distance 0.01 < 0.04 → immediate collision
    const collidingBodies: [BodyState, BodyState, BodyState] = [
      { id: 'r', mass: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { id: 'g', mass: 1, position: { x: 0.01, y: 0 }, velocity: { x: 0, y: 0 } },
      { id: 'b', mass: 1, position: { x: 0, y: 10 }, velocity: { x: 0, y: 0 } },
    ];
    const globals = useStore.getState().globals;

    useStore.setState({
      bodies: collidingBodies,
      time: 0,
      initialConditions: { bodies: collidingBodies, globals, time: 0 },
    });
    useStore.getState().play();

    const refs = makeRefs();
    processSimulationFrame(FRAME_MS, FRAME_MS, refs);

    const { activeCollisions } = useStore.getState();
    const pairs = activeCollisions.map(([pair]) => pair);
    expect(pairs).toContain('rg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Slice State Integration Tests — TC-ST13 through TC-ST17
// See specs/TESTING.md §9.4
// ─────────────────────────────────────────────────────────────────────────────

import { PRESETS } from '../../src/presets/presetData';

describe('Cross-Slice Integration (TC-ST13 – TC-ST17)', () => {
  beforeEach(resetStore);

  // ── TC-ST13 ──────────────────────────────────────────────────────────────────

  it('TC-ST13: Lab → Live mode switch commits staged values to active and starts simulation', () => {
    expect(useStore.getState().mode).toBe('lab');

    // Stage a change
    useStore.getState().setStagedBodyProperty('r', 'mass', 4.0);

    // Switch to live — should commit staged and resume
    useStore.getState().setMode('live');

    const s = useStore.getState();
    expect(s.mode).toBe('live');
    expect(s.bodies[0].mass).toBe(4.0); // staged value committed to active
    expect(s.isPlaying).toBe(true);
  });

  // ── TC-ST14 ──────────────────────────────────────────────────────────────────

  it('TC-ST14: Live → Lab mode switch pauses simulation and copies active state to staged', () => {
    // Move to live mode (commits staged, starts playing)
    useStore.getState().setMode('live');
    expect(useStore.getState().isPlaying).toBe(true);

    // Modify active state while live
    useStore.getState().setBodyProperty('g', 'mass', 8.0);

    // Switch back to lab
    useStore.getState().setMode('lab');

    const s = useStore.getState();
    expect(s.mode).toBe('lab');
    expect(s.isPlaying).toBe(false);
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![1].mass).toBe(8.0); // live state captured in staged
  });

  // ── TC-ST15 ──────────────────────────────────────────────────────────────────

  it('TC-ST15: reset restores initial conditions, zeros time, and clears trails', () => {
    const preset = PRESETS.find((p) => p.id === 'figure-eight')!;

    // Load preset in live mode so it becomes the reset target
    useStore.getState().setMode('live');
    useStore.getState().loadPreset(preset);

    // Advance state via applyNextState to simulate physics running
    useStore.getState().applyNextState({
      bodies: [
        { id: 'r', mass: 1, position: { x: 9.9, y: 9.9 }, velocity: { x: 0, y: 0 } },
        { id: 'g', mass: 1, position: { x: -9.9, y: -9.9 }, velocity: { x: 0, y: 0 } },
        { id: 'b', mass: 1, position: { x: 5.5, y: 5.5 }, velocity: { x: 0, y: 0 } },
      ],
      globals: useStore.getState().globals,
      time: 99.0,
    });
    expect(useStore.getState().time).toBe(99.0);

    useStore.getState().reset();

    const s = useStore.getState();
    expect(s.time).toBe(0);
    expect(s.isPlaying).toBe(false);
    expect(s.bodies[0].position.x).toBeCloseTo(preset.bodies[0].position.x, 4);
    expect(s.bodies[0].position.y).toBeCloseTo(preset.bodies[0].position.y, 4);
    expect(s.trailHistory[0].length).toBe(0);
    expect(s.trailHistory[1].length).toBe(0);
    expect(s.trailHistory[2].length).toBe(0);
  });

  // ── TC-ST16 ──────────────────────────────────────────────────────────────────

  it('TC-ST16: loadPreset in Lab Mode populates staged buffer without starting the simulation', () => {
    const preset = PRESETS.find((p) => p.id === 'lagrange-triangle')!;
    expect(useStore.getState().mode).toBe('lab');

    const activeXBefore = useStore.getState().bodies[0].position.x;

    useStore.getState().loadPreset(preset);

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![0].position.x).toBeCloseTo(preset.bodies[0].position.x, 4);
    expect(s.activePresetId).toBe(preset.id);
    expect(s.isPlaying).toBe(false);
    // Active bodies must remain unchanged
    expect(s.bodies[0].position.x).toBe(activeXBefore);
  });

  // ── TC-ST17 ──────────────────────────────────────────────────────────────────

  it('TC-ST17: loadPreset in Live Mode applies immediately to active state and updates initialConditions', () => {
    const preset = PRESETS.find((p) => p.id === 'figure-eight')!;

    useStore.getState().setMode('live');
    expect(useStore.getState().isPlaying).toBe(true);

    useStore.getState().loadPreset(preset);

    const s = useStore.getState();
    expect(s.bodies[0].position.x).toBeCloseTo(preset.bodies[0].position.x, 4);
    expect(s.globals.G).toBe(preset.globals.G);
    expect(s.activePresetId).toBe(preset.id);
    expect(s.isPlaying).toBe(true); // simulation remains running
    expect(s.initialConditions.bodies[0].position.x).toBeCloseTo(preset.bodies[0].position.x, 4);
  });
});
