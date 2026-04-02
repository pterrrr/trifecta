/**
 * Simulation Slice Tests — TC-ST01 through TC-ST04
 * See specs/TESTING.md §9.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';
import type { SimulationState } from '../../src/types';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

describe('SimulationSlice (TC-ST01 – TC-ST04)', () => {
  beforeEach(resetStore);

  // ── TC-ST01 ──────────────────────────────────────────────────────────────────

  it('TC-ST01: setBodyProperty updates the correct body without affecting others', () => {
    useStore.getState().setBodyProperty('r', 'mass', 5.0);

    const { bodies } = useStore.getState();
    expect(bodies[0].mass).toBe(5.0);
    expect(bodies[1].mass).toBe(1.0); // g — unchanged
    expect(bodies[2].mass).toBe(1.0); // b — unchanged
  });

  // ── TC-ST02 ──────────────────────────────────────────────────────────────────

  it('TC-ST02: setGlobal updates the matching global config field', () => {
    useStore.getState().setGlobal('G', 2.0);

    expect(useStore.getState().globals.G).toBe(2.0);
  });

  // ── TC-ST03 ──────────────────────────────────────────────────────────────────

  it('TC-ST03: applyNextState replaces bodies, globals, and time', () => {
    const next: SimulationState = {
      bodies: [
        { id: 'r', mass: 2.0, position: { x: 1.1, y: 2.2 }, velocity: { x: 0.1, y: 0.2 } },
        { id: 'g', mass: 3.0, position: { x: 3.3, y: 4.4 }, velocity: { x: 0.3, y: 0.4 } },
        { id: 'b', mass: 4.0, position: { x: 5.5, y: 6.6 }, velocity: { x: 0.5, y: 0.6 } },
      ],
      globals: { G: 1.0, softening: 0.05, trailLength: 500 },
      time: 42.0,
    };

    useStore.getState().applyNextState(next);

    const s = useStore.getState();
    expect(s.bodies[0].position.x).toBe(1.1);
    expect(s.bodies[0].position.y).toBe(2.2);
    expect(s.bodies[1].position.x).toBe(3.3);
    expect(s.bodies[1].position.y).toBe(4.4);
    expect(s.bodies[2].velocity.x).toBe(0.5);
    expect(s.bodies[2].velocity.y).toBe(0.6);
    expect(s.time).toBe(42.0);
  });

  // ── TC-ST04 ──────────────────────────────────────────────────────────────────

  it('TC-ST04: snapshotInitialConditions captures the current state exactly', () => {
    useStore.getState().setBodyProperty('r', 'mass', 7.5);
    useStore.getState().setBodyProperty('g', 'mass', 3.0);
    useStore.getState().setGlobal('G', 2.5);

    useStore.getState().snapshotInitialConditions();

    const { initialConditions, bodies, globals } = useStore.getState();

    expect(initialConditions.bodies[0].mass).toBe(bodies[0].mass);
    expect(initialConditions.bodies[1].mass).toBe(bodies[1].mass);
    expect(initialConditions.bodies[2].mass).toBe(bodies[2].mass);
    expect(initialConditions.bodies[0].position).toEqual(bodies[0].position);
    expect(initialConditions.bodies[1].position).toEqual(bodies[1].position);
    expect(initialConditions.globals.G).toBe(globals.G);

    // Snapshot must be a deep clone — mutating bodies should not affect it
    useStore.getState().setBodyProperty('r', 'mass', 99.0);
    expect(useStore.getState().initialConditions.bodies[0].mass).toBe(7.5);
  });
});
