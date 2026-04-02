import type { SimulationState } from '../types/simulation';
import { BODY_VARIABLE_RANGES, GLOBAL_VARIABLE_RANGES } from '../constants/defaults';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Float32 encoding introduces rounding errors on boundary values (e.g. 0.01
 * stored as float32 becomes ~0.009999999776). We allow a small tolerance so
 * that values that were in-range before encoding are not rejected after decoding.
 */
const FLOAT32_RANGE_TOLERANCE = 1e-4;

/** Returns true when value is a finite number within [min - ε, max + ε]. */
function inRange(value: number, min: number, max: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= min - FLOAT32_RANGE_TOLERANCE &&
    value <= max + FLOAT32_RANGE_TOLERANCE
  );
}

/**
 * Decode a Base64url seed string back to a SimulationState.
 *
 * Returns null if any of the following are true:
 * - Input is falsy or length !== 92
 * - Input contains characters outside [A-Za-z0-9_-]
 * - Decoded buffer is not 69 bytes
 * - Any decoded value falls outside its valid range (SPECS.md §1)
 */
export function decodeSeed(seed: string): SimulationState | null {
  if (!seed || seed.length !== 92) return null;
  if (!BASE64URL_RE.test(seed)) return null;

  // Convert Base64url → standard Base64 (no padding needed: 92 % 4 === 0)
  const b64 = seed.replace(/-/g, '+').replace(/_/g, '/');

  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return null;
  }

  if (binary.length !== 69) return null;

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);
  const br = BODY_VARIABLE_RANGES;
  const gr = GLOBAL_VARIABLE_RANGES;

  const ids = ['r', 'g', 'b'] as const;
  let offset = 0;

  const decodedBodies = ids.map((id) => {
    const mass = view.getFloat32(offset, true); offset += 4;
    const x    = view.getFloat32(offset, true); offset += 4;
    const y    = view.getFloat32(offset, true); offset += 4;
    const vx   = view.getFloat32(offset, true); offset += 4;
    const vy   = view.getFloat32(offset, true); offset += 4;
    return { id, mass, x, y, vx, vy };
  });

  const G         = view.getFloat32(offset, true); offset += 4;
  const softening = view.getFloat32(offset, true);

  // Range validation
  for (const b of decodedBodies) {
    if (!inRange(b.mass, br.mass.min,      br.mass.max))      return null;
    if (!inRange(b.x,    br.positionX.min, br.positionX.max)) return null;
    if (!inRange(b.y,    br.positionY.min, br.positionY.max)) return null;
    if (!inRange(b.vx,   br.velocityX.min, br.velocityX.max)) return null;
    if (!inRange(b.vy,   br.velocityY.min, br.velocityY.max)) return null;
  }

  if (!inRange(G,         gr.G.min,         gr.G.max))         return null;
  if (!inRange(softening, gr.softening.min, gr.softening.max)) return null;

  return {
    bodies: [
      { id: 'r', mass: decodedBodies[0].mass, position: { x: decodedBodies[0].x, y: decodedBodies[0].y }, velocity: { x: decodedBodies[0].vx, y: decodedBodies[0].vy } },
      { id: 'g', mass: decodedBodies[1].mass, position: { x: decodedBodies[1].x, y: decodedBodies[1].y }, velocity: { x: decodedBodies[1].vx, y: decodedBodies[1].vy } },
      { id: 'b', mass: decodedBodies[2].mass, position: { x: decodedBodies[2].x, y: decodedBodies[2].y }, velocity: { x: decodedBodies[2].vx, y: decodedBodies[2].vy } },
    ],
    globals: {
      G,
      softening,
      trailLength: 500, // not encoded in seed; restored to default
    },
    time: 0, // seeds always decode to t=0
  };
}
