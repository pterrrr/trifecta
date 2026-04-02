/**
 * ModeToggle Component Tests — TC-U06
 * See specs/TESTING.md §12.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useStore } from '../../src/state/store';
import { ModeToggle } from '../../src/components/ModeToggle/ModeToggle';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

describe('ModeToggle (TC-U06)', () => {
  beforeEach(resetStore);

  // ── TC-U06 ──────────────────────────────────────────────────────────────────

  it('TC-U06: clicking the "Live" label switches mode from lab to live', () => {
    expect(useStore.getState().mode).toBe('lab');

    render(<ModeToggle />);

    const liveLabel = screen.getByText('Live');
    fireEvent.click(liveLabel);

    expect(useStore.getState().mode).toBe('live');
  });

  it('TC-U06 (reverse): clicking the "Lab" label while in live mode switches back to lab', () => {
    // Move to live first
    useStore.getState().setMode('live');

    render(<ModeToggle />);

    const labLabel = screen.getByText('Lab');
    fireEvent.click(labLabel);

    expect(useStore.getState().mode).toBe('lab');
  });

  it('TC-U06 (keyboard): pressing Enter on "Live" triggers mode switch', () => {
    expect(useStore.getState().mode).toBe('lab');

    render(<ModeToggle />);

    const liveLabel = screen.getByText('Live');
    fireEvent.keyDown(liveLabel, { key: 'Enter' });

    expect(useStore.getState().mode).toBe('live');
  });
});
