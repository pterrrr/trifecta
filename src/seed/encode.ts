import type { SimulationState } from '../types/simulation';

/**
 * Encode 17 float values into a Base64url string (no padding).
 *
 * Packing order (deterministic):
 *   [0-4]   Body R: mass, pos.x, pos.y, vel.x, vel.y
 *   [5-9]   Body G: mass, pos.x, pos.y, vel.x, vel.y
 *   [10-14] Body B: mass, pos.x, pos.y, vel.x, vel.y
 *   [15]    G (gravitational constant)
 *   [16]    softening (ε)
 *
 * Each value is stored as a 32-bit IEEE 754 float (little-endian, 4 bytes).
 * Binary buffer: 17 × 4 = 68 bytes, padded to 69 bytes (divisible by 3).
 * Base64url output: 69 / 3 × 4 = 92 characters, no padding character (=).
 */
export function encodeSeed(state: SimulationState): string {
  // 69 bytes: 68 data bytes + 1 zero padding byte (makes length divisible by 3
  // so base64url output is exactly 92 chars with no trailing '=')
  const buffer = new ArrayBuffer(69);
  const view = new DataView(buffer);

  let offset = 0;

  for (const body of state.bodies) {
    view.setFloat32(offset, body.mass, true);        offset += 4;
    view.setFloat32(offset, body.position.x, true);  offset += 4;
    view.setFloat32(offset, body.position.y, true);  offset += 4;
    view.setFloat32(offset, body.velocity.x, true);  offset += 4;
    view.setFloat32(offset, body.velocity.y, true);  offset += 4;
  }

  view.setFloat32(offset, state.globals.G, true);          offset += 4;
  view.setFloat32(offset, state.globals.softening, true);  // offset + 4 = 68; byte 68 remains 0x00

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
