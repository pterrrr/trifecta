/**
 * ControlPanel Component Tests — TC-U01 through TC-U05
 * See specs/TESTING.md §12.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../src/state/store';
import { ControlPanel } from '../../src/components/ControlPanel/ControlPanel';
import { BodyControls } from '../../src/components/ControlPanel/BodyControls';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** All <input inputmode="decimal"> elements — these are NumberInput instances in body controls. */
function getNumberInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]');
}

/** All <input type="range"> elements — these are Slider instances. */
function getRangeInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>('input[type="range"]');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ControlPanel (TC-U01 – TC-U05)', () => {
  beforeEach(resetStore);

  // ── TC-U01 ──────────────────────────────────────────────────────────────────

  it('TC-U01: Lab Mode renders number inputs alongside sliders', () => {
    // Default mode is 'lab'
    expect(useStore.getState().mode).toBe('lab');

    const { container } = render(<ControlPanel />);

    // Each body has 5 controls (mass, posX, posY, velX, velY) × 3 bodies = 15
    const numberInputs = getNumberInputs(container);
    expect(numberInputs.length).toBeGreaterThanOrEqual(15);

    const sliders = getRangeInputs(container);
    expect(sliders.length).toBeGreaterThan(0);
  });

  // ── TC-U02 ──────────────────────────────────────────────────────────────────

  it('TC-U02: Live Mode renders only sliders — number inputs are absent', () => {
    useStore.getState().setMode('live');

    const { container } = render(<ControlPanel />);

    const numberInputs = getNumberInputs(container);
    expect(numberInputs.length).toBe(0);

    const sliders = getRangeInputs(container);
    expect(sliders.length).toBeGreaterThan(0);
  });

  // ── TC-U03 ──────────────────────────────────────────────────────────────────

  it('TC-U03: NumberInput clamps out-of-range value on blur (mass max = 100)', () => {
    expect(useStore.getState().mode).toBe('lab');

    const { container } = render(<BodyControls bodyId="r" />);

    // First decimal input in BodyControls for 'r' is the mass input (min=0.01, max=100)
    const massInput = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(massInput).toBeTruthy();

    fireEvent.change(massInput, { target: { value: '200' } });
    fireEvent.blur(massInput);

    // NumberInput calls onChange(100) → staged mass for r becomes 100
    const s = useStore.getState();
    const staged = s.stagedBodies;
    if (staged) {
      expect(staged[0].mass).toBe(100.0);
    } else {
      // If staged not created yet, assert the input display shows the clamped value
      expect(massInput.value).toBe('100');
    }
  });

  // ── TC-U04 ──────────────────────────────────────────────────────────────────

  it('TC-U04: Non-numeric input is rejected and reverts to previous valid value on blur', () => {
    expect(useStore.getState().mode).toBe('lab');

    const { container } = render(<BodyControls bodyId="r" />);

    const massInput = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    const originalValue = massInput.value;

    fireEvent.change(massInput, { target: { value: 'abc' } });
    fireEvent.blur(massInput);

    // Draft should revert; no store action should fire
    expect(massInput.value).toBe(originalValue);
    // Store staged must remain null (no valid change dispatched)
    expect(useStore.getState().stagedBodies).toBeNull();
  });

  // ── TC-U05 ──────────────────────────────────────────────────────────────────

  it('TC-U05: Lab Mode controls show "Pause to edit" and disable Random Reset while playing', () => {
    useStore.getState().play(); // isPlaying = true while in lab mode

    render(<ControlPanel />);

    // The hint text replaces the "Run Simulation" button
    expect(screen.getByText('Pause to edit')).toBeTruthy();

    // "Run Simulation" button must not be present
    expect(screen.queryByText('Run Simulation')).toBeNull();

    // Random Reset button must be disabled
    const randomResetBtn = screen.getByTitle(/random values/i);
    expect(randomResetBtn).toHaveProperty('disabled', true);
  });
});
