import type { BodyId, BodyState } from '../types';
import { ENERGY_DRIFT_ABSOLUTE } from '../constants/physics';

/**
 * Check if any body has exceeded the ejection boundary.
 * Returns the IDs of ejected bodies (if any).
 * See PHYSICS.md §10.1.
 */
export function detectEjections(
  bodies: [BodyState, BodyState, BodyState],
  hardBoundary: number
): BodyId[] {
  return bodies
    .filter(b => Math.abs(b.position.x) > hardBoundary || Math.abs(b.position.y) > hardBoundary)
    .map(b => b.id);
}

/**
 * Check if total energy has drifted beyond the instability threshold
 * compared to the initial total energy.
 *
 * Uses relative drift when |initialEnergy| >= ENERGY_DRIFT_ABSOLUTE,
 * falls back to absolute drift for near-zero initial energy.
 *
 * See PHYSICS.md §8.3.
 */
export function checkEnergyDrift(
  currentEnergy: number,
  initialEnergy: number,
  threshold: number
): boolean {
  const absDrift = Math.abs(currentEnergy - initialEnergy);

  if (Math.abs(initialEnergy) < ENERGY_DRIFT_ABSOLUTE) {
    // Near-zero initial energy: use absolute threshold
    return absDrift > ENERGY_DRIFT_ABSOLUTE;
  }

  // Normal case: relative drift
  return absDrift / Math.abs(initialEnergy) > threshold;
}
