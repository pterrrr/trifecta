/**
 * Playback Slice Tests — TC-ST05 through TC-ST09
 * See specs/TESTING.md §9.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

describe('PlaybackSlice (TC-ST05 – TC-ST09)', () => {
  beforeEach(resetStore);

  // ── TC-ST05 ──────────────────────────────────────────────────────────────────

  it('TC-ST05: play sets isPlaying to true', () => {
    expect(useStore.getState().isPlaying).toBe(false);

    useStore.getState().play();

    expect(useStore.getState().isPlaying).toBe(true);
  });

  // ── TC-ST06 ──────────────────────────────────────────────────────────────────

  it('TC-ST06: pause sets isPlaying to false', () => {
    useStore.getState().play();
    expect(useStore.getState().isPlaying).toBe(true);

    useStore.getState().pause();

    expect(useStore.getState().isPlaying).toBe(false);
  });

  // ── TC-ST07 ──────────────────────────────────────────────────────────────────

  it('TC-ST07: togglePlayPause flips isPlaying each call', () => {
    expect(useStore.getState().isPlaying).toBe(false);

    useStore.getState().togglePlayPause();
    expect(useStore.getState().isPlaying).toBe(true);

    useStore.getState().togglePlayPause();
    expect(useStore.getState().isPlaying).toBe(false);

    useStore.getState().togglePlayPause();
    expect(useStore.getState().isPlaying).toBe(true);
  });

  // ── TC-ST08 ──────────────────────────────────────────────────────────────────

  it('TC-ST08: setSpeed clamps values to the [0.1, 10.0] range', () => {
    useStore.getState().setSpeed(15.0);
    expect(useStore.getState().speed).toBe(10.0);

    useStore.getState().setSpeed(0.01);
    expect(useStore.getState().speed).toBe(0.1);

    useStore.getState().setSpeed(5.0);
    expect(useStore.getState().speed).toBe(5.0);
  });

  // ── TC-ST09 ──────────────────────────────────────────────────────────────────

  it('TC-ST09: setMode stores the new mode value', () => {
    expect(useStore.getState().mode).toBe('lab');

    // Lab → Live: commits staged buffer (sets isPlaying=true) and updates mode
    useStore.getState().setMode('live');
    expect(useStore.getState().mode).toBe('live');

    // Live → Lab: pauses and snapshots active → staged
    useStore.getState().setMode('lab');
    expect(useStore.getState().mode).toBe('lab');
  });
});
