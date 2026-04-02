import type { Preset } from '../types/presets';
import type { BodyState, GlobalConfig, SimulationState } from '../types/simulation';
import { encodeSeed } from '../seed/encode';

const DEFAULT_TRAIL_LENGTH = 500;

function makeGlobals(G = 1.0, softening = 0.05): GlobalConfig {
  return { G, softening, trailLength: DEFAULT_TRAIL_LENGTH };
}

function makeBodies(
  r: Omit<BodyState, 'id'>,
  g: Omit<BodyState, 'id'>,
  b: Omit<BodyState, 'id'>,
): [BodyState, BodyState, BodyState] {
  return [
    { id: 'r', ...r },
    { id: 'g', ...g },
    { id: 'b', ...b },
  ];
}

function makePreset(
  partial: Omit<Preset, 'seed'> & { bodies: [BodyState, BodyState, BodyState]; globals: GlobalConfig },
): Preset {
  const state: SimulationState = {
    bodies: partial.bodies,
    globals: partial.globals,
    time: 0,
  };
  return { ...partial, seed: encodeSeed(state) };
}

// ─── 1. Figure-Eight (Choreographic) ─────────────────────────────────────────
// Chenciner-Montgomery solution: all three equal-mass bodies trace a single
// figure-eight path with equal time offsets.

const figureEightBodies = makeBodies(
  { mass: 1.0, position: { x: -0.97000436, y:  0.24308753 }, velocity: { x:  0.46620368, y:  0.43236573 } },
  { mass: 1.0, position: { x:  0.97000436, y: -0.24308753 }, velocity: { x:  0.46620368, y:  0.43236573 } },
  { mass: 1.0, position: { x:  0.0,        y:  0.0        }, velocity: { x: -0.93240737, y: -0.86473146 } },
);

// ─── 2. Lagrange Triangle (Stable) ───────────────────────────────────────────
// Three equal-mass bodies at equilateral triangle vertices orbiting their
// common center of mass with equal angular velocities.

const lagrangeTriangleBodies = makeBodies(
  { mass: 1.0, position: { x:  1.0,  y:  0.0        }, velocity: { x:  0.0,         y:  0.5       } },
  { mass: 1.0, position: { x: -0.5,  y:  0.86602540 }, velocity: { x: -0.43301270,  y: -0.25      } },
  { mass: 1.0, position: { x: -0.5,  y: -0.86602540 }, velocity: { x:  0.43301270,  y: -0.25      } },
);

// ─── 3. Sun-Earth-Moon (Hierarchical) ────────────────────────────────────────
// Large central mass with a smaller orbiter and a much smaller moon-like body
// orbiting the smaller one.
//
// M_sun = 50 (down from 100) so velocities stay within the ±5 AU/t range:
//   v_earth = √(G·M_sun / r_earth)  = √(50/5) ≈ 3.162
//   v_moon  = v_earth + √(G·M_earth / Δr)  = 3.162 + √(1/0.3) ≈ 4.988  (<5)

const sunEarthMoonBodies = makeBodies(
  { mass: 50.0, position: { x: 0.0, y: 0.0 }, velocity: { x: 0.0, y: 0.0         } },
  { mass: 1.0,  position: { x: 5.0, y: 0.0 }, velocity: { x: 0.0, y: 3.16227766  } },
  { mass: 0.01, position: { x: 5.3, y: 0.0 }, velocity: { x: 0.0, y: 4.98801952  } },
);

// ─── 4. Butterfly (Choreographic) ────────────────────────────────────────────
// A butterfly-shaped periodic orbit from the Li-Liao family of choreographic
// solutions.

const butterflyBodies = makeBodies(
  { mass: 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x:  0.30689, y:  0.12551 } },
  { mass: 1.0, position: { x:  1.0, y: 0.0 }, velocity: { x:  0.30689, y:  0.12551 } },
  { mass: 1.0, position: { x:  0.0, y: 0.0 }, velocity: { x: -0.61378, y: -0.25102 } },
);

// ─── 5. Chaotic Scatter (Chaotic) ─────────────────────────────────────────────
// Three near-equal masses in an asymmetric configuration — rapid divergence
// with no special symmetry to stabilise motion.

const chaoticScatterBodies = makeBodies(
  { mass: 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x:  0.0, y:  0.5 } },
  { mass: 1.0, position: { x:  1.0, y: 0.0 }, velocity: { x:  0.0, y: -0.5 } },
  { mass: 1.0, position: { x:  0.0, y: 1.5 }, velocity: { x:  0.3, y:  0.0 } },
);

// ─── 6. Binary + Orbiter (Hierarchical) ──────────────────────────────────────
// Two bodies in a tight binary orbit; a third body orbits the binary pair at
// a much wider radius.

const binaryOrbiterBodies = makeBodies(
  { mass: 1.0, position: { x: -0.5, y: 0.0 }, velocity: { x: 0.0, y: -0.70710678 } },
  { mass: 1.0, position: { x:  0.5, y: 0.0 }, velocity: { x: 0.0, y:  0.70710678 } },
  { mass: 0.5, position: { x:  4.0, y: 0.0 }, velocity: { x: 0.0, y:  0.55901699 } },
);

// ─── 7. Head-On Approach (Collision) ─────────────────────────────────────────
// Three unequal masses aimed roughly toward a common centre — produces
// dramatic close encounters and collision visual effects.

const headOnApproachBodies = makeBodies(
  { mass: 1.5, position: { x: -3.0, y: -1.0 }, velocity: { x:  1.0, y:  0.3 } },
  { mass: 1.0, position: { x:  3.0, y: -1.0 }, velocity: { x: -1.0, y:  0.4 } },
  { mass: 1.2, position: { x:  0.0, y:  3.0 }, velocity: { x:  0.1, y: -1.0 } },
);

// ─── 8. Broucke-Hadjidemetriou (Stable) ──────────────────────────────────────
// A member of the Broucke-Hadjidemetriou family of periodic solutions with
// complex but repeating trajectories.

const brouckeHadjidemetriouBodies = makeBodies(
  { mass: 1.0, position: { x: -0.98922, y: 0.0 }, velocity: { x: 0.0, y: -0.86103 } },
  { mass: 1.0, position: { x:  2.20400, y: 0.0 }, velocity: { x: 0.0, y:  0.43909 } },
  { mass: 1.0, position: { x: -1.21478, y: 0.0 }, velocity: { x: 0.0, y:  0.42194 } },
);

// ─── Preset Array ─────────────────────────────────────────────────────────────

export const PRESETS: Preset[] = [
  makePreset({
    id: 'figure-eight',
    name: 'Figure-Eight',
    description: 'All three bodies trace a single figure-eight path with equal time offsets. The Chenciner-Montgomery choreographic solution.',
    category: 'choreographic',
    bodies: figureEightBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'lagrange-triangle',
    name: 'Lagrange Triangle',
    description: 'Three equal-mass bodies form an equilateral triangle and orbit their common center of mass at constant angular velocity.',
    category: 'stable',
    bodies: lagrangeTriangleBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'sun-earth-moon',
    name: 'Sun-Earth-Moon',
    description: 'Mimics a star-planet-moon system with a large mass ratio. The tiny moon orbits the planet while the planet orbits the star.',
    category: 'hierarchical',
    bodies: sunEarthMoonBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'butterfly',
    name: 'Butterfly',
    description: 'A butterfly-shaped periodic orbit from the Li-Liao family of choreographic solutions.',
    category: 'choreographic',
    bodies: butterflyBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'chaotic-scatter',
    name: 'Chaotic Scatter',
    description: 'Near-equal masses in an asymmetric, unstable configuration. Sensitive to initial conditions — trajectories rapidly diverge.',
    category: 'chaotic',
    bodies: chaoticScatterBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'binary-orbiter',
    name: 'Binary + Orbiter',
    description: 'Two bodies in a tight binary orbit with a third body in a wide outer orbit around the binary pair.',
    category: 'hierarchical',
    bodies: binaryOrbiterBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'head-on-approach',
    name: 'Head-On Approach',
    description: 'Three bodies aimed roughly toward each other — produces dramatic close encounters and collision bursts.',
    category: 'collision',
    bodies: headOnApproachBodies,
    globals: makeGlobals(),
  }),

  makePreset({
    id: 'broucke-hadjidemetriou',
    name: 'Broucke-Hadjidemetriou',
    description: 'A known family of periodic solutions with complex but repeating paths. Named after Broucke (1975).',
    category: 'stable',
    bodies: brouckeHadjidemetriouBodies,
    globals: makeGlobals(),
  }),
];
