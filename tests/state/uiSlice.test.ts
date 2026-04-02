/**
 * UI Slice Tests — TC-ST18 (activePresetId clearing)
 * See specs/TESTING.md §9.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../../src/state/store';
import { PRESETS } from '../../src/presets/presetData';

function resetStore() {
  useStore.setState(useStore.getInitialState());
}

describe('UiSlice — activePresetId clearing (TC-ST18)', () => {
  beforeEach(resetStore);

  it('TC-ST18: setBodyProperty clears activePresetId', () => {
    // Use live mode so setBodyProperty directly modifies active state
    useStore.getState().setMode('live');

    const preset = PRESETS[0];
    useStore.getState().loadPreset(preset);
    expect(useStore.getState().activePresetId).toBe(preset.id);

    useStore.getState().setBodyProperty('r', 'mass', 2.0);

    expect(useStore.getState().activePresetId).toBeNull();
  });

  it('TC-ST18 (setGlobal): setGlobal also clears activePresetId', () => {
    useStore.getState().setMode('live');

    const preset = PRESETS[0];
    useStore.getState().loadPreset(preset);
    expect(useStore.getState().activePresetId).toBe(preset.id);

    useStore.getState().setGlobal('G', 2.0);

    expect(useStore.getState().activePresetId).toBeNull();
  });

  it('TC-ST18 (staged): setStagedBodyProperty clears activePresetId in lab mode', () => {
    // Load preset in lab mode (populates staged, sets activePresetId)
    const preset = PRESETS[0];
    useStore.getState().loadPreset(preset);
    expect(useStore.getState().activePresetId).toBe(preset.id);

    useStore.getState().setStagedBodyProperty('r', 'mass', 5.0);

    expect(useStore.getState().activePresetId).toBeNull();
  });
});
