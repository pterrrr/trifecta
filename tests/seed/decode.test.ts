import { describe, it, expect } from 'vitest';
import { encodeSeed } from '../../src/seed/encode';
import { decodeSeed } from '../../src/seed/decode';
import type { SimulationState } from '../../src/types/simulation';

/** A valid baseline state used as the source for most decode tests. */
const VALID_STATE: SimulationState = {
  bodies: [
    { id: 'r', mass: 1.0, position: { x: -1.0, y: 0.0 }, velocity: { x: 0.0, y: 0.5 } },
    { id: 'g', mass: 1.0, position: { x: 1.0, y: 0.0 },  velocity: { x: 0.0, y: -0.5 } },
    { id: 'b', mass: 1.0, position: { x: 0.0, y: 1.0 },  velocity: { x: 0.0, y: 0.0 } },
  ],
  globals: { G: 1.0, softening: 0.05, trailLength: 500 },
  time: 0,
};

/**
 * Build a raw 69-byte buffer, overwrite one float32 at byteOffset with the
 * given value, and return the resulting base64url seed string.
 * This lets tests craft seeds with out-of-range values.
 */
function buildSeedWithFloat(byteOffset: number, value: number): string {
  // Start from a fully valid buffer
  const validSeed = encodeSeed(VALID_STATE);

  // Decode the valid seed to raw bytes
  const b64 = validSeed.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Overwrite the target float32 (little-endian)
  const view = new DataView(bytes.buffer);
  view.setFloat32(byteOffset, value, true);

  // Re-encode to base64url
  let raw = '';
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i]);
  }
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// TC-S04: valid seed → valid SimulationState
describe('TC-S04: valid seed produces valid state', () => {
  it('returns a non-null SimulationState for a known valid seed', () => {
    const seed = encodeSeed(VALID_STATE);
    const result = decodeSeed(seed);

    expect(result).not.toBeNull();
    expect(result!.bodies).toHaveLength(3);
    expect(result!.bodies[0].id).toBe('r');
    expect(result!.bodies[1].id).toBe('g');
    expect(result!.bodies[2].id).toBe('b');
  });

  it('all decoded values are within defined ranges', () => {
    const seed = encodeSeed(VALID_STATE);
    const state = decodeSeed(seed)!;

    for (const body of state.bodies) {
      expect(body.mass).toBeGreaterThanOrEqual(0.01);
      expect(body.mass).toBeLessThanOrEqual(100.0);
      expect(body.position.x).toBeGreaterThanOrEqual(-10.0);
      expect(body.position.x).toBeLessThanOrEqual(10.0);
      expect(body.position.y).toBeGreaterThanOrEqual(-10.0);
      expect(body.position.y).toBeLessThanOrEqual(10.0);
      expect(body.velocity.x).toBeGreaterThanOrEqual(-5.0);
      expect(body.velocity.x).toBeLessThanOrEqual(5.0);
      expect(body.velocity.y).toBeGreaterThanOrEqual(-5.0);
      expect(body.velocity.y).toBeLessThanOrEqual(5.0);
    }

    expect(state.globals.G).toBeGreaterThanOrEqual(0.01);
    expect(state.globals.G).toBeLessThanOrEqual(10.0);
    expect(state.globals.softening).toBeGreaterThanOrEqual(0.001);
    expect(state.globals.softening).toBeLessThanOrEqual(1.0);
  });
});

// TC-S05: invalid length rejected
describe('TC-S05: invalid length returns null', () => {
  it('returns null for a seed of length 91 (one char short)', () => {
    const seed = encodeSeed(VALID_STATE);
    expect(decodeSeed(seed.slice(0, 91))).toBeNull();
  });

  it('returns null for a seed of length 93 (one char extra)', () => {
    const seed = encodeSeed(VALID_STATE);
    expect(decodeSeed(seed + 'A')).toBeNull();
  });
});

// TC-S06: invalid characters rejected
describe('TC-S06: invalid characters return null', () => {
  it('returns null when seed contains "+" (standard base64, not base64url)', () => {
    const seed = encodeSeed(VALID_STATE).slice(0, 91) + '+';
    expect(decodeSeed(seed)).toBeNull();
  });

  it('returns null when seed contains "/" (standard base64, not base64url)', () => {
    const seed = encodeSeed(VALID_STATE).slice(0, 91) + '/';
    expect(decodeSeed(seed)).toBeNull();
  });

  it('returns null when seed contains "=" (padding character)', () => {
    const seed = encodeSeed(VALID_STATE).slice(0, 91) + '=';
    expect(decodeSeed(seed)).toBeNull();
  });

  it('returns null when seed contains a space', () => {
    const seed = encodeSeed(VALID_STATE).slice(0, 91) + ' ';
    expect(decodeSeed(seed)).toBeNull();
  });
});

// TC-S07: out-of-range values rejected
describe('TC-S07: out-of-range values return null', () => {
  it('returns null when body R mass decodes to 200.0 (max is 100.0)', () => {
    // Byte offset 0 = body R mass (first float32)
    const invalidSeed = buildSeedWithFloat(0, 200.0);
    expect(decodeSeed(invalidSeed)).toBeNull();
  });

  it('returns null when body G position x decodes to 15.0 (max is 10.0)', () => {
    // Body G starts at byte 20; position x is at offset 20 + 4 = 24
    const invalidSeed = buildSeedWithFloat(24, 15.0);
    expect(decodeSeed(invalidSeed)).toBeNull();
  });

  it('returns null when G decodes to 0.0 (min is 0.01)', () => {
    // G is at byte offset 60 (15 × 4)
    const invalidSeed = buildSeedWithFloat(60, 0.0);
    expect(decodeSeed(invalidSeed)).toBeNull();
  });

  it('returns null when softening decodes to 0.0 (min is 0.001)', () => {
    // softening is at byte offset 64 (16 × 4)
    const invalidSeed = buildSeedWithFloat(64, 0.0);
    expect(decodeSeed(invalidSeed)).toBeNull();
  });
});

// TC-S08: empty string rejected
describe('TC-S08: empty string returns null', () => {
  it('returns null for an empty string', () => {
    expect(decodeSeed('')).toBeNull();
  });
});
