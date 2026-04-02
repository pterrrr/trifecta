import type { StateCreator } from 'zustand';
import type {
  ActiveBodyFocus,
  DataVariable,
  PanelVisibility,
  VisualFilters,
} from '../../types';
import {
  DEFAULT_VISUAL_FILTERS,
  DEFAULT_VISIBLE_DATA_VARIABLES,
} from '../../constants';
import type { TrifectaStore } from '../store';

export interface UiSlice {
  activeBodyFocus: ActiveBodyFocus;
  filters: VisualFilters;
  panelVisibility: PanelVisibility;
  visibleDataVariables: DataVariable[];
  activePresetId: string | null;

  setActiveBodyFocus: (body: ActiveBodyFocus) => void;
  setFilter: (filter: keyof VisualFilters, value: boolean) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
  toggleDataVariable: (variable: DataVariable) => void;
  setActivePresetId: (id: string | null) => void;
}

export const createUiSlice: StateCreator<
  TrifectaStore,
  [],
  [],
  UiSlice
> = (set) => ({
  activeBodyFocus: null,
  filters: { ...DEFAULT_VISUAL_FILTERS },
  panelVisibility: { controlPanel: true, dataPanel: false },
  visibleDataVariables: [...DEFAULT_VISIBLE_DATA_VARIABLES],
  activePresetId: null,

  setActiveBodyFocus: (body) => set({ activeBodyFocus: body }),

  setFilter: (filter, value) =>
    set((s) => ({
      filters: { ...s.filters, [filter]: value },
    })),

  togglePanel: (panel) =>
    set((s) => ({
      panelVisibility: {
        ...s.panelVisibility,
        [panel]: !s.panelVisibility[panel],
      },
    })),

  toggleDataVariable: (variable) =>
    set((s) => {
      const current = s.visibleDataVariables;
      const idx = current.indexOf(variable);
      if (idx >= 0) {
        return { visibleDataVariables: current.filter((v) => v !== variable) };
      }
      return { visibleDataVariables: [...current, variable] };
    }),

  setActivePresetId: (id) => set({ activePresetId: id }),
});
