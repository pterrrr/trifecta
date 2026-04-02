import type { BodyState, BodyPair, CollisionEvent } from '../types';

// Pair definitions: [indexA, indexB]
const PAIRS: { pair: BodyPair; a: number; b: number }[] = [
  { pair: 'rg', a: 0, b: 1 },
  { pair: 'rb', a: 0, b: 2 },
  { pair: 'gb', a: 1, b: 2 },
];

/**
 * Detect visual collisions between bodies.
 * A collision occurs when the distance between two bodies is less than
 * the sum of their visual radii (derived from mass via collisionThresholdFn).
 *
 * Returns an array of collision events for pairs that are newly colliding
 * (not already in cooldown).
 *
 * NOTE: This is for visual effects only. No physics response is computed.
 * See PHYSICS.md §9 for formulas.
 */
export function detectCollisions(
  _prevBodies: [BodyState, BodyState, BodyState],
  currBodies: [BodyState, BodyState, BodyState],
  cooldowns: Set<BodyPair>,
  collisionThresholdFn: (massA: number, massB: number) => number
): CollisionEvent[] {
  const events: CollisionEvent[] = [];

  for (const { pair, a, b } of PAIRS) {
    if (cooldowns.has(pair)) continue;

    const bodyA = currBodies[a];
    const bodyB = currBodies[b];

    const dx = bodyA.position.x - bodyB.position.x;
    const dy = bodyA.position.y - bodyB.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const threshold = collisionThresholdFn(bodyA.mass, bodyB.mass);

    if (dist < threshold) {
      // Midpoint of collision
      const point = {
        x: (bodyA.position.x + bodyB.position.x) / 2,
        y: (bodyA.position.y + bodyB.position.y) / 2,
      };

      // Relative speed: projection of relative velocity onto connecting line
      // relativeSpeed = |(vA - vB) · (rA - rB)| / |rA - rB|
      // See PHYSICS.md §9.4
      let relativeSpeed = 0;
      if (dist > 0) {
        const dvx = bodyA.velocity.x - bodyB.velocity.x;
        const dvy = bodyA.velocity.y - bodyB.velocity.y;
        relativeSpeed = Math.abs(dvx * dx + dvy * dy) / dist;
      }

      events.push({ pair, point, relativeSpeed, timestamp: 0 });
    }
  }

  return events;
}

/**
 * Check if a pair has separated enough to exit cooldown.
 * Separation threshold = 1.5 × collision threshold.
 * See PHYSICS.md §9.3.
 */
export function checkSeparation(
  bodies: [BodyState, BodyState, BodyState],
  pair: BodyPair,
  separationThresholdFn: (massA: number, massB: number) => number
): boolean {
  const { a, b } = PAIRS.find(p => p.pair === pair)!;
  const bodyA = bodies[a];
  const bodyB = bodies[b];

  const dx = bodyA.position.x - bodyB.position.x;
  const dy = bodyA.position.y - bodyB.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist > separationThresholdFn(bodyA.mass, bodyB.mass);
}
