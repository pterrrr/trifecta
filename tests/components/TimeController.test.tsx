/**
 * TimeController Component Tests — TC-U10 through TC-U14
 * See specs/TESTING.md §12.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../src/state/store';
import { TimeController } from '../../src/components/TimeController/TimeController';

function resetStore() {
  useStore.setState(useStore.getInitialState());
  useStore.getState().clearTrails();
  useStore.getState().clearGraphHistory();
}

describe('TimeController (TC-U10 – TC-U14)', () => {
  beforeEach(resetStore);

  // ── TC-U10 ──────────────────────────────────────────────────────────────────

  it('TC-U10: clicking the Play button starts playback (isPlaying becomes true)', () => {
    expect(useStore.getState().isPlaying).toBe(false);

    render(<TimeController />);

    const playButton = screen.getByTitle('Play (Space)');
    fireEvent.click(playButton);

    expect(useStore.getState().isPlaying).toBe(true);
  });

  // ── TC-U11 ──────────────────────────────────────────────────────────────────

  it('TC-U11: clicking the Pause button stops playback (isPlaying becomes false)', () => {
    useStore.getState().play();
    expect(useStore.getState().isPlaying).toBe(true);

    render(<TimeController />);

    const pauseButton = screen.getByTitle('Pause (Space)');
    fireEvent.click(pauseButton);

    expect(useStore.getState().isPlaying).toBe(false);
  });

  // ── TC-U12 ──────────────────────────────────────────────────────────────────

  it('TC-U12: clicking the Reset button restores initial conditions and stops playback', () => {
    // Snapshot initial conditions, then advance state
    useStore.getState().snapshotInitialConditions();
    useStore.getState().play();
    useStore.getState().applyNextState({
      bodies: useStore.getState().bodies,
      globals: useStore.getState().globals,
      time: 99.0,
    });
    expect(useStore.getState().time).toBe(99.0);

    render(<TimeController />);

    const resetButton = screen.getByTitle('Reset (R)');
    fireEvent.click(resetButton);

    const s = useStore.getState();
    expect(s.time).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  // ── TC-U13 ──────────────────────────────────────────────────────────────────

  it('TC-U13: Step Forward button is disabled when the simulation is playing', () => {
    useStore.getState().play();
    expect(useStore.getState().isPlaying).toBe(true);

    render(<TimeController />);

    const stepButton = screen.getByTitle('Step Forward');
    expect(stepButton).toHaveProperty('disabled', true);
  });

  it('TC-U13 (enabled when paused): Step Forward button is enabled when paused', () => {
    expect(useStore.getState().isPlaying).toBe(false);

    render(<TimeController />);

    const stepButton = screen.getByTitle('Step Forward');
    expect(stepButton).toHaveProperty('disabled', false);
  });

  // ── TC-U14 ──────────────────────────────────────────────────────────────────

  it('TC-U14: changing the speed slider updates the store speed', () => {
    render(<TimeController />);

    const slider = screen.getByTitle('Simulation speed');
    fireEvent.change(slider, { target: { value: '5' } });

    expect(useStore.getState().speed).toBe(5.0);
  });

  it('TC-U14 (clamping via store): speed is clamped to [0.1, 10.0] range', () => {
    render(<TimeController />);

    const slider = screen.getByTitle('Simulation speed');

    fireEvent.change(slider, { target: { value: '0.05' } });
    expect(useStore.getState().speed).toBe(0.1);

    fireEvent.change(slider, { target: { value: '15' } });
    expect(useStore.getState().speed).toBe(10.0);
  });
});
