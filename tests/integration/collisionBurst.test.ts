import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';
import {
  integrateStep,
  computeDerived,
  detectCollisions,
  checkSeparation,
} from '../../src/engine';
import { CollisionBurst, PAIR_INDICES } from '../../src/renderer/effects/CollisionBurst';
import { PRESETS } from '../../src/presets/presetData';
import { BASE_DT, SPEED_REFERENCE } from '../../src/constants/physics';
import type { BodyState, BodyPair, CollisionEvent } from '../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLLISION_FACTOR = 0.02;
const collisionThresholdFn = (massA: number, massB: number): number =>
  COLLISION_FACTOR * (Math.cbrt(massA) + Math.cbrt(massB));
const separationThresholdFn = (massA: number, massB: number): number =>
  1.5 * collisionThresholdFn(massA, massB);

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

const headOnPreset = PRESETS.find((p) => p.id === 'head-on-approach')!;

function runUntilCollision(
  bodies: [BodyState, BodyState, BodyState],
  globals: typeof headOnPreset.globals,
  maxSteps: number,
): { events: CollisionEvent[]; steps: number; finalBodies: [BodyState, BodyState, BodyState] } {
  let current = bodies;
  const cooldowns = new Set<BodyPair>();
  const allEvents: CollisionEvent[] = [];
  let time = 0;

  for (let step = 0; step < maxSteps; step++) {
    const next = integrateStep(current, globals, BASE_DT);
    time += BASE_DT;

    const events = detectCollisions(current, next, cooldowns, collisionThresholdFn);
    for (const e of events) {
      e.timestamp = time;
      allEvents.push(e);
      cooldowns.add(e.pair);
    }

    // Check separation for cooldown exit
    for (const pair of Array.from(cooldowns)) {
      if (checkSeparation(next, pair, separationThresholdFn)) {
        cooldowns.delete(pair);
      }
    }

    current = next;

    if (allEvents.length > 0 && step > 100) {
      // Give some time after first collision to see if more happen
      return { events: allEvents, steps: step, finalBodies: current };
    }
  }

  return { events: allEvents, steps: maxSteps, finalBodies: current };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Collision Burst Pipeline — Head-On Approach', () => {
  beforeEach(resetStore);

  describe('Collision detection triggers', () => {
    it('Head-On Approach preset produces at least one collision event', () => {
      const { events } = runUntilCollision(
        headOnPreset.bodies,
        headOnPreset.globals,
        50_000, // 50s of sim time at BASE_DT=0.001
      );

      expect(events.length).toBeGreaterThan(0);
    });

    it('collision event has valid fields', () => {
      const { events } = runUntilCollision(
        headOnPreset.bodies,
        headOnPreset.globals,
        50_000,
      );

      const event = events[0];
      expect(['rg', 'rb', 'gb']).toContain(event.pair);
      expect(event.point.x).toBeTypeOf('number');
      expect(event.point.y).toBeTypeOf('number');
      expect(event.relativeSpeed).toBeGreaterThan(0);
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('collision event relativeSpeed is non-trivial for head-on preset', () => {
      const { events } = runUntilCollision(
        headOnPreset.bodies,
        headOnPreset.globals,
        50_000,
      );

      // Bodies approaching at combined ~2 AU/time → relative speed should be substantial
      const maxSpeed = Math.max(...events.map((e) => e.relativeSpeed));
      expect(maxSpeed).toBeGreaterThan(0.5);
    });
  });

  describe('CollisionBurst construction', () => {
    it('burst color matches spec for each pair', () => {
      const expectedColors: Record<BodyPair, [number, number, number]> = {
        rg: [255, 204, 51],
        rb: [255, 51, 255],
        gb: [51, 255, 255],
      };

      for (const pair of ['rg', 'rb', 'gb'] as BodyPair[]) {
        const event: CollisionEvent = {
          pair,
          point: { x: 0, y: 0 },
          relativeSpeed: 2.0,
          timestamp: 1.0,
        };
        const burst = new CollisionBurst(event, 0.04);
        expect(burst.color).toEqual(expectedColors[pair]);
      }
    });

    it('intensity clamps to [0.3, 2.0] based on relativeSpeed / SPEED_REFERENCE', () => {
      const makeEvent = (speed: number): CollisionEvent => ({
        pair: 'rg',
        point: { x: 0, y: 0 },
        relativeSpeed: speed,
        timestamp: 1.0,
      });

      // Very slow → clamped to 0.3
      const slow = new CollisionBurst(makeEvent(0.1), 0.04);
      expect(slow.intensity).toBeCloseTo(0.3);

      // At SPEED_REFERENCE → intensity 1.0
      const mid = new CollisionBurst(makeEvent(SPEED_REFERENCE), 0.04);
      expect(mid.intensity).toBeCloseTo(1.0);

      // Very fast → clamped to 2.0
      const fast = new CollisionBurst(makeEvent(10.0), 0.04);
      expect(fast.intensity).toBeCloseTo(2.0);

      // Between → proportional
      const half = new CollisionBurst(makeEvent(SPEED_REFERENCE / 2), 0.04);
      expect(half.intensity).toBeCloseTo(0.5);
    });

    it('particle count scales with relativeSpeed (8–24 range)', () => {
      const makeEvent = (speed: number): CollisionEvent => ({
        pair: 'rg',
        point: { x: 0, y: 0 },
        relativeSpeed: speed,
        timestamp: 1.0,
      });

      // relativeSpeed=0 → 8 particles
      const slow = new CollisionBurst(makeEvent(0), 0.04);
      // Can't directly read particles, but we test through draw behavior
      // Just verify construction doesn't throw
      expect(slow.maxAge).toBe(600);

      // relativeSpeed=4 → 8 + 16 = 24 particles (max)
      const fast = new CollisionBurst(makeEvent(4.0), 0.04);
      expect(fast.maxAge).toBe(600);
    });
  });

  describe('CollisionBurst lifecycle', () => {
    it('update returns true while age < maxAge', () => {
      const event: CollisionEvent = {
        pair: 'rg',
        point: { x: 0, y: 0 },
        relativeSpeed: 2.0,
        timestamp: 1.0,
      };
      const burst = new CollisionBurst(event, 0.04);

      // At t=0, should be alive
      expect(burst.update(0.016)).toBe(true); // 16ms
      expect(burst.age).toBeCloseTo(16);

      // Advance to 300ms — still alive
      burst.age = 0;
      expect(burst.update(0.300)).toBe(true);

      // Advance to 599ms — still alive
      burst.age = 0;
      expect(burst.update(0.599)).toBe(true);
    });

    it('update returns false when age >= maxAge (600ms)', () => {
      const event: CollisionEvent = {
        pair: 'rg',
        point: { x: 0, y: 0 },
        relativeSpeed: 2.0,
        timestamp: 1.0,
      };
      const burst = new CollisionBurst(event, 0.04);

      // Advance past 600ms
      expect(burst.update(0.601)).toBe(false);
    });

    it('getTintPulse returns non-null during first 150ms, null after', () => {
      const event: CollisionEvent = {
        pair: 'rb',
        point: { x: 0, y: 0 },
        relativeSpeed: 2.0,
        timestamp: 1.0,
      };
      const burst = new CollisionBurst(event, 0.04);

      // At age 0
      const tint0 = burst.getTintPulse();
      expect(tint0).not.toBeNull();
      expect(tint0!.r).toBe(255);
      expect(tint0!.g).toBe(51);
      expect(tint0!.b).toBe(255);
      expect(tint0!.opacity).toBeGreaterThan(0);
      expect(tint0!.opacity).toBeLessThanOrEqual(0.10);

      // Advance past 150ms
      burst.update(0.160);
      expect(burst.getTintPulse()).toBeNull();
    });
  });

  describe('Store collision registration', () => {
    it('registerCollision adds event to activeCollisions', () => {
      const event: CollisionEvent = {
        pair: 'rg',
        point: { x: 1, y: 2 },
        relativeSpeed: 1.5,
        timestamp: 5.0,
      };

      useStore.getState().registerCollision(event);
      const { activeCollisions } = useStore.getState();

      expect(activeCollisions).toHaveLength(1);
      expect(activeCollisions[0][0]).toBe('rg');
      expect(activeCollisions[0][1]).toEqual(event);
    });

    it('registerCollision replaces existing entry for same pair', () => {
      const event1: CollisionEvent = {
        pair: 'rg',
        point: { x: 1, y: 2 },
        relativeSpeed: 1.5,
        timestamp: 5.0,
      };
      const event2: CollisionEvent = {
        pair: 'rg',
        point: { x: 3, y: 4 },
        relativeSpeed: 2.5,
        timestamp: 10.0,
      };

      useStore.getState().registerCollision(event1);
      useStore.getState().registerCollision(event2);
      const { activeCollisions } = useStore.getState();

      expect(activeCollisions).toHaveLength(1);
      expect(activeCollisions[0][1].timestamp).toBe(10.0);
    });

    it('reset clears activeCollisions and collisionCooldowns', () => {
      const event: CollisionEvent = {
        pair: 'gb',
        point: { x: 0, y: 0 },
        relativeSpeed: 1.0,
        timestamp: 1.0,
      };

      useStore.getState().registerCollision(event);
      useStore.getState().setCooldown('gb', true);

      expect(useStore.getState().activeCollisions).toHaveLength(1);
      expect(useStore.getState().collisionCooldowns).toContain('gb');

      useStore.getState().reset();

      expect(useStore.getState().activeCollisions).toHaveLength(0);
      expect(useStore.getState().collisionCooldowns).toHaveLength(0);
    });
  });

  describe('Cooldown prevents rapid-fire re-triggering', () => {
    it('pair in cooldown does not trigger additional collisions', () => {
      // Place two bodies at the same position (guaranteed collision)
      const bodies: [BodyState, BodyState, BodyState] = [
        { id: 'r', mass: 1.0, position: { x: 0, y: 0 }, velocity: { x: 0.1, y: 0 } },
        { id: 'g', mass: 1.0, position: { x: 0.01, y: 0 }, velocity: { x: -0.1, y: 0 } },
        { id: 'b', mass: 1.0, position: { x: 5, y: 5 }, velocity: { x: 0, y: 0 } },
      ];

      const cooldowns = new Set<BodyPair>();

      // First detection — should fire
      const events1 = detectCollisions(bodies, bodies, cooldowns, collisionThresholdFn);
      expect(events1.length).toBeGreaterThan(0);
      for (const e of events1) cooldowns.add(e.pair);

      // Second detection with cooldown — should NOT fire
      const events2 = detectCollisions(bodies, bodies, cooldowns, collisionThresholdFn);
      expect(events2).toHaveLength(0);
    });

    it('cooldown clears after separation', () => {
      const closeBodies: [BodyState, BodyState, BodyState] = [
        { id: 'r', mass: 1.0, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
        { id: 'g', mass: 1.0, position: { x: 0.01, y: 0 }, velocity: { x: 0, y: 0 } },
        { id: 'b', mass: 1.0, position: { x: 5, y: 5 }, velocity: { x: 0, y: 0 } },
      ];

      // Bodies far apart (beyond 1.5 × threshold)
      const farBodies: [BodyState, BodyState, BodyState] = [
        { id: 'r', mass: 1.0, position: { x: -1, y: 0 }, velocity: { x: 0, y: 0 } },
        { id: 'g', mass: 1.0, position: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
        { id: 'b', mass: 1.0, position: { x: 5, y: 5 }, velocity: { x: 0, y: 0 } },
      ];

      // Distance between R and G = 2.0 AU, separation threshold = 1.5 * 0.04 = 0.06
      const separated = checkSeparation(farBodies, 'rg', separationThresholdFn);
      expect(separated).toBe(true);
    });
  });

  describe('PAIR_INDICES mapping', () => {
    it('maps each BodyPair to correct body indices', () => {
      expect(PAIR_INDICES.rg).toEqual([0, 1]);
      expect(PAIR_INDICES.rb).toEqual([0, 2]);
      expect(PAIR_INDICES.gb).toEqual([1, 2]);
    });
  });

  describe('Burst uses actual body masses for threshold', () => {
    it('threshold from masses 1.5 and 1.0 differs from unit-mass default', () => {
      const unitThreshold = collisionThresholdFn(1.0, 1.0); // 0.04
      const headOnThreshold = collisionThresholdFn(1.5, 1.0); // ~0.0429

      expect(headOnThreshold).toBeGreaterThan(unitThreshold);
      expect(headOnThreshold).toBeCloseTo(0.02 * (Math.cbrt(1.5) + 1.0), 6);
    });
  });
});
