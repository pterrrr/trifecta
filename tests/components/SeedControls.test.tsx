/**
 * SeedControls Component Tests — TC-U07 through TC-U09
 * See specs/TESTING.md §12.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useStore } from '../../src/state/store';
import { SeedControls } from '../../src/components/ControlPanel/SeedControls';
import { encodeSeed } from '../../src/seed/encode';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

/** Build a valid 92-character seed from an arbitrary known state. */
function buildValidSeed() {
  return encodeSeed({
    bodies: [
      { id: 'r', mass: 2.0, position: { x: 1.0, y: -1.0 }, velocity: { x: 0.5, y: 0.3 } },
      { id: 'g', mass: 3.0, position: { x: -2.0, y: 2.0 }, velocity: { x: -0.4, y: 0.2 } },
      { id: 'b', mass: 1.5, position: { x: 0.5, y: 0.5 }, velocity: { x: 0.1, y: -0.5 } },
    ],
    globals: { G: 1.0, softening: 0.05, trailLength: 500 },
    time: 0,
  });
}

describe('SeedControls (TC-U07 – TC-U09)', () => {
  beforeEach(() => {
    resetStore();
    // Reset clipboard mock between tests
    vi.restoreAllMocks();
  });

  // ── TC-U07 ──────────────────────────────────────────────────────────────────

  it('TC-U07: pasting a valid 92-char seed and clicking Load calls loadSeed with decoded state', () => {
    const validSeed = buildValidSeed();
    expect(validSeed).toHaveLength(92);

    render(<SeedControls />);

    const pasteInput = screen.getByPlaceholderText('Paste seed…');
    fireEvent.change(pasteInput, { target: { value: validSeed } });

    const loadButton = screen.getByText('Load');
    fireEvent.click(loadButton);

    // In lab mode, loadSeed populates stagedBodies
    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![0].mass).toBeCloseTo(2.0, 1);

    // Input field should be cleared after successful load
    expect(pasteInput).toHaveProperty('value', '');
  });

  it('TC-U07 (Enter key): pressing Enter in the paste input triggers the load', () => {
    const validSeed = buildValidSeed();

    render(<SeedControls />);

    const pasteInput = screen.getByPlaceholderText('Paste seed…');
    fireEvent.change(pasteInput, { target: { value: validSeed } });
    fireEvent.keyDown(pasteInput, { key: 'Enter' });

    const s = useStore.getState();
    expect(s.stagedBodies).not.toBeNull();
  });

  // ── TC-U08 ──────────────────────────────────────────────────────────────────

  it('TC-U08: pasting an invalid seed string shows an error message without modifying state', () => {
    const originalBodies = useStore.getState().bodies;

    render(<SeedControls />);

    const pasteInput = screen.getByPlaceholderText('Paste seed…');
    fireEvent.change(pasteInput, { target: { value: 'invalid_seed_string' } });

    const loadButton = screen.getByText('Load');
    fireEvent.click(loadButton);

    // Error message must appear
    expect(screen.getByText('Invalid seed')).toBeTruthy();

    // State must be unchanged
    const s = useStore.getState();
    expect(s.bodies[0].mass).toBe(originalBodies[0].mass);
    expect(s.stagedBodies).toBeNull();
  });

  it('TC-U08 (error clears on edit): typing in the paste field after an error removes the error', () => {
    render(<SeedControls />);

    const pasteInput = screen.getByPlaceholderText('Paste seed…');
    fireEvent.change(pasteInput, { target: { value: 'bad' } });
    fireEvent.click(screen.getByText('Load'));

    expect(screen.getByText('Invalid seed')).toBeTruthy();

    // Start typing a new value — error should disappear
    fireEvent.change(pasteInput, { target: { value: 'x' } });

    expect(screen.queryByText('Invalid seed')).toBeNull();
  });

  // ── TC-U09 ──────────────────────────────────────────────────────────────────

  it('TC-U09: clicking Copy calls the Clipboard API with the current seed string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<SeedControls />);

    const copyButton = screen.getByText('Copy');
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    // The argument must be a non-empty 92-char seed
    const calledWith: string = writeText.mock.calls[0][0];
    expect(calledWith).toMatch(/^[A-Za-z0-9_-]{92}$/);
  });

  it('TC-U09 (confirmation): "Copied!" feedback appears after successful copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<SeedControls />);

    const copyButton = screen.getByText('Copy');
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // The confirmation element exists in the DOM (visibility is CSS-driven, but the text is present)
    expect(screen.getByText('Copied!')).toBeTruthy();
  });
});
