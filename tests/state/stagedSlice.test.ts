/**
 * Staged Slice Tests — TC-ST10 through TC-ST12
 * See specs/TESTING.md §9.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';

function resetStore() {
  useStore.setState(useStore.getInitialState());
  useStore.getState().clearTrails();
  useStore.getState().clearGraphHistory();
}

describe('StagedSlice (TC-ST10 – TC-ST12)', () => {
  beforeEach(resetStore);

  // ── TC-ST10 ──────────────────────────────────────────────────────────────────

  it('TC-ST10: setStagedBodyProperty writes to staged buffer without touching active state', () => {
    const activeMassBefore = useStore.getState().bodies[1].mass; // body g

    useStore.getState().setStagedBodyProperty('g', 'mass', 3.0);

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![1].mass).toBe(3.0);
    expect(s.bodies[1].mass).toBe(activeMassBefore); // active unchanged
  });

  it('TC-ST10 (fallback): staged buffer is seeded from active when null before first write', () => {
    expect(useStore.getState().stagedBodies).toBeNull();

    useStore.getState().setStagedBodyProperty('r', 'mass', 7.0);

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    // Other bodies should be copied from active
    expect(s.stagedBodies![1].mass).toBe(s.bodies[1].mass);
    expect(s.stagedBodies![2].mass).toBe(s.bodies[2].mass);
  });

  // ── TC-ST11 ──────────────────────────────────────────────────────────────────

  it('TC-ST11: commitStaged applies staged values to active state, starts playing, and snapshots', () => {
    useStore.getState().setStagedBodyProperty('r', 'mass', 5.0);
    useStore.getState().setStagedBodyProperty('g', 'mass', 3.0);
    useStore.getState().setStagedBodyProperty('b', 'mass', 2.5);

    useStore.getState().commitStaged();

    const s = useStore.getState();
    expect(s.bodies[0].mass).toBe(5.0);
    expect(s.bodies[1].mass).toBe(3.0);
    expect(s.bodies[2].mass).toBe(2.5);
    expect(s.isPlaying).toBe(true);
    // initialConditions should reflect the committed values so reset returns here
    expect(s.initialConditions.bodies[0].mass).toBe(5.0);
    expect(s.initialConditions.bodies[1].mass).toBe(3.0);
  });

  it('TC-ST11 (time reset): commitStaged resets simulation time to 0', () => {
    // Simulate some elapsed time
    useStore.getState().applyNextState({
      bodies: useStore.getState().bodies,
      globals: useStore.getState().globals,
      time: 42.0,
    });

    useStore.getState().commitStaged();

    expect(useStore.getState().time).toBe(0);
  });

  // ── TC-ST12 ──────────────────────────────────────────────────────────────────

  it('TC-ST12: snapshotToStaged copies the current active state into the staged buffer', () => {
    // Modify active state directly
    useStore.getState().setBodyProperty('b', 'mass', 9.0);
    useStore.getState().setBodyProperty('r', 'mass', 4.5);

    useStore.getState().snapshotToStaged();

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![0].mass).toBe(s.bodies[0].mass); // r
    expect(s.stagedBodies![1].mass).toBe(s.bodies[1].mass); // g
    expect(s.stagedBodies![2].mass).toBe(9.0);              // b
    expect(s.stagedGlobals).not.toBeNull();
    expect(s.stagedGlobals!.G).toBe(s.globals.G);
  });

  it('TC-ST12 (deep clone): stagedBodies is a deep copy — mutating active should not affect staged', () => {
    useStore.getState().snapshotToStaged();
    const stagedMassBefore = useStore.getState().stagedBodies![0].mass;

    // Mutate active
    useStore.getState().setBodyProperty('r', 'mass', 99.0);

    expect(useStore.getState().stagedBodies![0].mass).toBe(stagedMassBefore);
  });
});
