import type { BodyState, GlobalConfig } from '../types';

/**
 * Perform one RK4 integration step.
 * Takes the current body states, global config, and timestep.
 * Returns the new body states after dt has elapsed.
 *
 * State is packed into a flat Float64Array(12) for performance:
 * [x1,y1, x2,y2, x3,y3, vx1,vy1, vx2,vy2, vx3,vy3]
 *
 * See PHYSICS.md §5 for the full derivation.
 */
export function integrateStep(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig,
  dt: number
): [BodyState, BodyState, BodyState] {
  const { G, softening } = globals;
  const eps2 = softening * softening;
  const m0 = bodies[0].mass;
  const m1 = bodies[1].mass;
  const m2 = bodies[2].mass;

  const Y = packState(bodies);

  const f = (state: Float64Array): Float64Array =>
    computeDerivatives(state, G, eps2, m0, m1, m2);

  // RK4 stages
  const k1 = f(Y);
  const k2 = f(addScaled(Y, k1, dt / 2));
  const k3 = f(addScaled(Y, k2, dt / 2));
  const k4 = f(addScaled(Y, k3, dt));

  // Weighted combination: Y(t+dt) = Y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
  const Ynext = new Float64Array(12);
  const dt6 = dt / 6;
  for (let i = 0; i < 12; i++) {
    Ynext[i] = Y[i] + dt6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  return unpackState(Ynext, bodies);
}

/** Pack body states into flat Float64Array(12). */
function packState(bodies: [BodyState, BodyState, BodyState]): Float64Array {
  const Y = new Float64Array(12);
  for (let i = 0; i < 3; i++) {
    Y[i * 2] = bodies[i].position.x;
    Y[i * 2 + 1] = bodies[i].position.y;
    Y[6 + i * 2] = bodies[i].velocity.x;
    Y[6 + i * 2 + 1] = bodies[i].velocity.y;
  }
  return Y;
}

/** Unpack flat Float64Array(12) back to body state tuple, preserving id and mass. */
function unpackState(
  Y: Float64Array,
  original: [BodyState, BodyState, BodyState]
): [BodyState, BodyState, BodyState] {
  return [
    {
      id: original[0].id,
      mass: original[0].mass,
      position: { x: Y[0], y: Y[1] },
      velocity: { x: Y[6], y: Y[7] },
    },
    {
      id: original[1].id,
      mass: original[1].mass,
      position: { x: Y[2], y: Y[3] },
      velocity: { x: Y[8], y: Y[9] },
    },
    {
      id: original[2].id,
      mass: original[2].mass,
      position: { x: Y[4], y: Y[5] },
      velocity: { x: Y[10], y: Y[11] },
    },
  ] as [BodyState, BodyState, BodyState];
}

/** Y + scale * dY, element-wise. */
function addScaled(
  Y: Float64Array,
  dY: Float64Array,
  scale: number
): Float64Array {
  const result = new Float64Array(12);
  for (let i = 0; i < 12; i++) {
    result[i] = Y[i] + scale * dY[i];
  }
  return result;
}

/**
 * Compute the derivative vector dY/dt from a packed state array.
 * dY/dt = [vx1,vy1, vx2,vy2, vx3,vy3, ax1,ay1, ax2,ay2, ax3,ay3]
 */
function computeDerivatives(
  state: Float64Array,
  G: number,
  eps2: number,
  m0: number,
  m1: number,
  m2: number
): Float64Array {
  // Positions
  const x0 = state[0], y0 = state[1];
  const x1 = state[2], y1 = state[3];
  const x2 = state[4], y2 = state[5];

  // Velocities
  const vx0 = state[6], vy0 = state[7];
  const vx1 = state[8], vy1 = state[9];
  const vx2 = state[10], vy2 = state[11];

  // Pairwise displacement vectors
  const dx01 = x1 - x0, dy01 = y1 - y0;
  const dx02 = x2 - x0, dy02 = y2 - y0;
  const dx12 = x2 - x1, dy12 = y2 - y1;

  // Softened inverse cube factors: 1 / (r² + ε²)^(3/2)
  const r01_sq = dx01 * dx01 + dy01 * dy01 + eps2;
  const r02_sq = dx02 * dx02 + dy02 * dy02 + eps2;
  const r12_sq = dx12 * dx12 + dy12 * dy12 + eps2;

  const inv01 = 1 / (r01_sq * Math.sqrt(r01_sq));
  const inv02 = 1 / (r02_sq * Math.sqrt(r02_sq));
  const inv12 = 1 / (r12_sq * Math.sqrt(r12_sq));

  // Accelerations
  const ax0 = G * (m1 * dx01 * inv01 + m2 * dx02 * inv02);
  const ay0 = G * (m1 * dy01 * inv01 + m2 * dy02 * inv02);

  const ax1 = G * (m0 * (-dx01) * inv01 + m2 * dx12 * inv12);
  const ay1 = G * (m0 * (-dy01) * inv01 + m2 * dy12 * inv12);

  const ax2 = G * (m0 * (-dx02) * inv02 + m1 * (-dx12) * inv12);
  const ay2 = G * (m0 * (-dy02) * inv02 + m1 * (-dy12) * inv12);

  // dY/dt: positions change by velocities, velocities change by accelerations
  const dY = new Float64Array(12);
  dY[0] = vx0; dY[1] = vy0;
  dY[2] = vx1; dY[3] = vy1;
  dY[4] = vx2; dY[5] = vy2;
  dY[6] = ax0; dY[7] = ay0;
  dY[8] = ax1; dY[9] = ay1;
  dY[10] = ax2; dY[11] = ay2;
  return dY;
}
