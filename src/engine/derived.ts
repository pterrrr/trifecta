import type { BodyState, GlobalConfig, SystemDerived } from '../types';
import { computeAccelerations } from './forces';

/**
 * Compute all derived variables from current state.
 * Called once per physics step (or once per render frame if physics is paused).
 * See PHYSICS.md §7 for all formulas.
 */
export function computeDerived(
  bodies: [BodyState, BodyState, BodyState],
  globals: GlobalConfig
): SystemDerived {
  const { G, softening } = globals;
  const eps2 = softening * softening;

  const [b0, b1, b2] = bodies;

  // ─── Accelerations (from forces module) ───
  const accels = computeAccelerations(bodies, globals);

  // ─── Per-body derived values ───
  const speeds = bodies.map(b => Math.sqrt(b.velocity.x ** 2 + b.velocity.y ** 2));
  const kineticEnergies = bodies.map((b, i) => 0.5 * b.mass * speeds[i] ** 2);

  // ─── Pairwise distances (unsoftened, for display) ───
  const dxRG = b1.position.x - b0.position.x;
  const dyRG = b1.position.y - b0.position.y;
  const dxRB = b2.position.x - b0.position.x;
  const dyRB = b2.position.y - b0.position.y;
  const dxGB = b2.position.x - b1.position.x;
  const dyGB = b2.position.y - b1.position.y;

  const distRG = Math.sqrt(dxRG ** 2 + dyRG ** 2);
  const distRB = Math.sqrt(dxRB ** 2 + dyRB ** 2);
  const distGB = Math.sqrt(dxGB ** 2 + dyGB ** 2);

  // ─── Pairwise potential energies (softened, for energy conservation) ───
  // PEᵢⱼ = -G · mᵢ · mⱼ / √(dᵢⱼ² + ε²)
  const peRG = -G * b0.mass * b1.mass / Math.sqrt(distRG ** 2 + eps2);
  const peRB = -G * b0.mass * b2.mass / Math.sqrt(distRB ** 2 + eps2);
  const peGB = -G * b1.mass * b2.mass / Math.sqrt(distGB ** 2 + eps2);

  // ─── Total energy ───
  const totalKE = kineticEnergies[0] + kineticEnergies[1] + kineticEnergies[2];
  const totalPE = peRG + peRB + peGB;
  const totalEnergy = totalKE + totalPE;

  // ─── Center of mass ───
  const totalMass = b0.mass + b1.mass + b2.mass;
  const centerOfMass = {
    x: (b0.mass * b0.position.x + b1.mass * b1.position.x + b2.mass * b2.position.x) / totalMass,
    y: (b0.mass * b0.position.y + b1.mass * b1.position.y + b2.mass * b2.position.y) / totalMass,
  };

  // ─── Total linear momentum ───
  const totalMomentum = {
    x: b0.mass * b0.velocity.x + b1.mass * b1.velocity.x + b2.mass * b2.velocity.x,
    y: b0.mass * b0.velocity.y + b1.mass * b1.velocity.y + b2.mass * b2.velocity.y,
  };

  // ─── Total angular momentum (z-component, scalar in 2D) ───
  // L = Σᵢ mᵢ · (xᵢ · vyᵢ - yᵢ · vxᵢ)
  const angularMomentum = bodies.reduce((sum, b) =>
    sum + b.mass * (b.position.x * b.velocity.y - b.position.y * b.velocity.x), 0
  );

  return {
    bodyDerived: [
      { speed: speeds[0], acceleration: accels[0], kineticEnergy: kineticEnergies[0] },
      { speed: speeds[1], acceleration: accels[1], kineticEnergy: kineticEnergies[1] },
      { speed: speeds[2], acceleration: accels[2], kineticEnergy: kineticEnergies[2] },
    ],
    distances: { rg: distRG, rb: distRB, gb: distGB },
    potentialEnergies: { rg: peRG, rb: peRB, gb: peGB },
    totalEnergy,
    angularMomentum,
    centerOfMass,
    totalMomentum,
  };
}
