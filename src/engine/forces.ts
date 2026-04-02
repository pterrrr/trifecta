import type { BodyState, GlobalConfig, Vector2D } from '../types';

/**
 * Compute the gravitational acceleration on each body due to all other bodies.
 * Uses Plummer softening: denominator is (r² + ε²)^(3/2).
 * Each pairwise interaction is computed once and Newton's 3rd law applied.
 */
export function computeAccelerations(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig
): [Vector2D, Vector2D, Vector2D] {
  const { G, softening } = globals;
  const eps2 = softening * softening;

  const p0 = bodies[0].position;
  const p1 = bodies[1].position;
  const p2 = bodies[2].position;
  const m0 = bodies[0].mass;
  const m1 = bodies[1].mass;
  const m2 = bodies[2].mass;

  // Pairwise displacement vectors (from i to j)
  const dx01 = p1.x - p0.x, dy01 = p1.y - p0.y;
  const dx02 = p2.x - p0.x, dy02 = p2.y - p0.y;
  const dx12 = p2.x - p1.x, dy12 = p2.y - p1.y;

  // Softened inverse cube factors: 1 / (r² + ε²)^(3/2)
  const r01_sq = dx01 * dx01 + dy01 * dy01 + eps2;
  const r02_sq = dx02 * dx02 + dy02 * dy02 + eps2;
  const r12_sq = dx12 * dx12 + dy12 * dy12 + eps2;

  const inv01 = 1 / (r01_sq * Math.sqrt(r01_sq));
  const inv02 = 1 / (r02_sq * Math.sqrt(r02_sq));
  const inv12 = 1 / (r12_sq * Math.sqrt(r12_sq));

  // Accelerations: a_i = G * Σ(j≠i) m_j * (r_j - r_i) * inv_ij
  const ax0 = G * (m1 * dx01 * inv01 + m2 * dx02 * inv02);
  const ay0 = G * (m1 * dy01 * inv01 + m2 * dy02 * inv02);

  const ax1 = G * (m0 * (-dx01) * inv01 + m2 * dx12 * inv12);
  const ay1 = G * (m0 * (-dy01) * inv01 + m2 * dy12 * inv12);

  const ax2 = G * (m0 * (-dx02) * inv02 + m1 * (-dx12) * inv12);
  const ay2 = G * (m0 * (-dy02) * inv02 + m1 * (-dy12) * inv12);

  return [
    { x: ax0, y: ay0 },
    { x: ax1, y: ay1 },
    { x: ax2, y: ay2 },
  ];
}
