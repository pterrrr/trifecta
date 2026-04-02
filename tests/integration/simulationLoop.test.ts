import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';
import {
  integrateStep,
  computeDerived,
  detectCollisions,
  detectEjections,
  checkEnergyDrift,
} from '../../src/engine';
import { computeTargetViewport, lerpViewport } from '../../src/renderer/viewport';
import { BASE_DT, HARD_BOUNDARY, ENERGY_DRIFT_WARNING } from '../../src/constants/physics';
import type { BodyState, BodyPair } from '../../src/types';

/**
 * Integration tests verifying the simulation loop behavior:
 * - Bodies move under gravity
 * - Trails are recorded
 * - Pause/resume works
 * - Viewport auto-scales
 * - No errors in the pipeline
 */

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

describe('Simulation Loop Integration', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Bodies orbit and interact under gravity', () => {
    it('integrateStep moves bodies from their initial positions', () => {
      const { bodies, globals } = useStore.getState();

      const next = integrateStep(bodies, globals, BASE_DT);

      // At least one body should have moved
      const moved = next.some(
        (b, i) =>
          b.position.x !== bodies[i].position.x ||
          b.position.y !== bodies[i].position.y,
      );
      expect(moved).toBe(true);
    });

    it('bodies accelerate toward each other (gravitational attraction)', () => {
      const { bodies, globals } = useStore.getState();
      const derived = computeDerived(bodies, globals);

      // Body R at (-1, 0): acceleration should have positive x component (toward G and B)
      expect(derived.bodyDerived[0].acceleration.x).toBeGreaterThan(0);

      // Body G at (1, 0): acceleration should have negative x component (toward R and B)
      expect(derived.bodyDerived[1].acceleration.x).toBeLessThan(0);
    });

    it('running multiple steps produces significant displacement', () => {
      const { globals } = useStore.getState();
      let bodies = useStore.getState().bodies;

      const initialPositions = bodies.map((b) => ({ ...b.position }));

      // Run 100 physics steps
      for (let i = 0; i < 100; i++) {
        bodies = integrateStep(bodies, globals, BASE_DT);
      }

      // Check that all bodies have moved noticeably
      for (let i = 0; i < 3; i++) {
        const dx = bodies[i].position.x - initialPositions[i].x;
        const dy = bodies[i].position.y - initialPositions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(0);
      }
    });

    it('energy is approximately conserved over 1000 steps', () => {
      const { globals } = useStore.getState();
      let bodies = useStore.getState().bodies;

      const initialDerived = computeDerived(bodies, globals);
      const initialEnergy = initialDerived.totalEnergy;

      for (let i = 0; i < 1000; i++) {
        bodies = integrateStep(bodies, globals, BASE_DT);
      }

      const finalDerived = computeDerived(bodies, globals);
      const drift = Math.abs(finalDerived.totalEnergy - initialEnergy);
      const relativeDrift =
        Math.abs(initialEnergy) > 0.01
          ? drift / Math.abs(initialEnergy)
          : drift;

      // RK4 should conserve energy to within 1% over 1000 steps
      expect(relativeDrift).toBeLessThan(0.01);
    });
  });

  describe('Trails are recorded and color-coded', () => {
    it('pushTrailPoint records positions for each body', () => {
      const store = useStore.getState();
      const { bodies } = store;

      // Push trail points for each body
      for (let i = 0; i < 3; i++) {
        store.pushTrailPoint(i, {
          position: { ...bodies[i].position },
          timestamp: 0,
        });
      }

      const { trailHistory } = useStore.getState();

      // Each body should have exactly 1 trail point
      expect(trailHistory[0]).toHaveLength(1);
      expect(trailHistory[1]).toHaveLength(1);
      expect(trailHistory[2]).toHaveLength(1);

      // Trail points match body positions
      expect(trailHistory[0][0].position.x).toBe(bodies[0].position.x);
      expect(trailHistory[1][0].position.x).toBe(bodies[1].position.x);
      expect(trailHistory[2][0].position.x).toBe(bodies[2].position.x);
    });

    it('trail history accumulates over multiple simulation frames', () => {
      // Clear any trails from prior tests
      useStore.getState().clearTrails();

      const { globals } = useStore.getState();
      let bodies = useStore.getState().bodies;
      let time = 0;

      // Simulate 10 frames, each with 16 physics steps
      for (let frame = 0; frame < 10; frame++) {
        for (let step = 0; step < 16; step++) {
          bodies = integrateStep(bodies, globals, BASE_DT);
          time += BASE_DT;
        }

        // Push one trail point per frame (matches real loop behavior)
        const store = useStore.getState();
        store.applyNextState({ bodies, globals, time });
        for (let i = 0; i < 3; i++) {
          store.pushTrailPoint(i, {
            position: { ...bodies[i].position },
            timestamp: time,
          });
        }
      }

      const { trailHistory } = useStore.getState();
      expect(trailHistory[0]).toHaveLength(10);
      expect(trailHistory[1]).toHaveLength(10);
      expect(trailHistory[2]).toHaveLength(10);

      // Positions should be different across trail points (bodies moved)
      expect(trailHistory[0][0].position.x).not.toBe(
        trailHistory[0][9].position.x,
      );
    });

    it('trail bodies are indexed as R=0, G=1, B=2', () => {
      const store = useStore.getState();
      const { bodies } = store;

      // Bodies should be R, G, B in order
      expect(bodies[0].id).toBe('r');
      expect(bodies[1].id).toBe('g');
      expect(bodies[2].id).toBe('b');
    });
  });

  describe('Pause stops motion; resume continues', () => {
    it('play/pause toggles isPlaying flag', () => {
      expect(useStore.getState().isPlaying).toBe(false);

      useStore.getState().play();
      expect(useStore.getState().isPlaying).toBe(true);

      useStore.getState().pause();
      expect(useStore.getState().isPlaying).toBe(false);
    });

    it('togglePlayPause alternates state', () => {
      expect(useStore.getState().isPlaying).toBe(false);

      useStore.getState().togglePlayPause();
      expect(useStore.getState().isPlaying).toBe(true);

      useStore.getState().togglePlayPause();
      expect(useStore.getState().isPlaying).toBe(false);
    });

    it('state is preserved across pause/resume', () => {
      const { globals } = useStore.getState();
      let bodies = useStore.getState().bodies;

      // Run some physics
      for (let i = 0; i < 50; i++) {
        bodies = integrateStep(bodies, globals, BASE_DT);
      }

      // Apply state (simulating what the loop does)
      useStore.getState().applyNextState({
        bodies,
        globals,
        time: 50 * BASE_DT,
      });

      // "Pause" — snapshot the state
      const pausedBodies = useStore.getState().bodies;
      const pausedTime = useStore.getState().time;

      useStore.getState().pause();

      // State should be unchanged while paused
      expect(useStore.getState().bodies).toEqual(pausedBodies);
      expect(useStore.getState().time).toBe(pausedTime);

      // "Resume"
      useStore.getState().play();

      // State should still be the same (no physics ran yet)
      expect(useStore.getState().bodies).toEqual(pausedBodies);
      expect(useStore.getState().time).toBe(pausedTime);
    });
  });

  describe('Viewport auto-scales smoothly', () => {
    it('computeTargetViewport frames all bodies', () => {
      const { bodies } = useStore.getState();
      const vp = computeTargetViewport(bodies, 800, 800, 0.2);

      // Viewport center should be near the centroid of body positions
      const avgX =
        (bodies[0].position.x +
          bodies[1].position.x +
          bodies[2].position.x) /
        3;
      const avgY =
        (bodies[0].position.y +
          bodies[1].position.y +
          bodies[2].position.y) /
        3;

      expect(Math.abs(vp.centerX - avgX)).toBeLessThan(1);
      expect(Math.abs(vp.centerY - avgY)).toBeLessThan(1);
      expect(vp.scale).toBeGreaterThan(0);
    });

    it('lerpViewport smoothly transitions between viewports', () => {
      const current = {
        centerX: 0,
        centerY: 0,
        scale: 100,
        canvasWidth: 800,
        canvasHeight: 800,
      };
      const target = {
        centerX: 10,
        centerY: 5,
        scale: 200,
        canvasWidth: 800,
        canvasHeight: 800,
      };

      const lerped = lerpViewport(current, target, 0.1);

      // Should move 10% toward target
      expect(lerped.centerX).toBeCloseTo(1.0, 5);
      expect(lerped.centerY).toBeCloseTo(0.5, 5);
      expect(lerped.scale).toBeCloseTo(110, 5);
    });

    it('viewport adjusts when bodies spread apart', () => {
      const { bodies } = useStore.getState();

      const vpNear = computeTargetViewport(bodies, 800, 800, 0.2);

      // Spread bodies far apart
      const farBodies: [BodyState, BodyState, BodyState] = [
        { ...bodies[0], position: { x: -10, y: 0 } },
        { ...bodies[1], position: { x: 10, y: 0 } },
        { ...bodies[2], position: { x: 0, y: 10 } },
      ];

      const vpFar = computeTargetViewport(farBodies, 800, 800, 0.2);

      // Scale should decrease (zoomed out) for farther bodies
      expect(vpFar.scale).toBeLessThan(vpNear.scale);
    });
  });

  describe('Pipeline produces no errors', () => {
    it('full simulation frame pipeline runs without throwing', () => {
      const { bodies, globals } = useStore.getState();

      // Simulate one full frame: integrate, derive, detect collisions/ejections, check energy
      const nextBodies = integrateStep(bodies, globals, BASE_DT);
      const derived = computeDerived(nextBodies, globals);
      const initialDerived = computeDerived(bodies, globals);

      const cooldowns = new Set<BodyPair>();
      const collisionThreshold = (mA: number, mB: number) =>
        0.02 * (Math.cbrt(mA) + Math.cbrt(mB));

      const collisions = detectCollisions(
        bodies,
        nextBodies,
        cooldowns,
        collisionThreshold,
      );
      const ejected = detectEjections(nextBodies, HARD_BOUNDARY);
      const drifted = checkEnergyDrift(
        derived.totalEnergy,
        initialDerived.totalEnergy,
        ENERGY_DRIFT_WARNING,
      );

      expect(collisions).toBeInstanceOf(Array);
      expect(ejected).toBeInstanceOf(Array);
      expect(typeof drifted).toBe('boolean');

      // No ejections on default config
      expect(ejected).toHaveLength(0);
      // No energy drift after one step
      expect(drifted).toBe(false);
    });

    it('graph sampling produces valid data', () => {
      const { globals } = useStore.getState();
      let bodies = useStore.getState().bodies;

      // Run a few steps and push a graph sample
      for (let i = 0; i < 16; i++) {
        bodies = integrateStep(bodies, globals, BASE_DT);
      }

      const derived = computeDerived(bodies, globals);
      const store = useStore.getState();
      store.pushGraphSample(16 * BASE_DT, derived);

      const { graphHistory } = useStore.getState();
      expect(graphHistory).toHaveLength(1);

      const sample = graphHistory[0];
      expect(sample.time).toBeCloseTo(16 * BASE_DT, 10);
      expect(typeof sample.speedR).toBe('number');
      expect(typeof sample.totalEnergy).toBe('number');
      expect(sample.speedR).toBeGreaterThanOrEqual(0);
    });
  });
});
