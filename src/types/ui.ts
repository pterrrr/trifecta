import type { BodyId } from './simulation';

export type InteractionMode = 'lab' | 'live';

export type ResponsiveTier = 'desktop' | 'tablet' | 'mobile';

export type ActiveBodyFocus = BodyId | null;   // Which body's controls are focused

export interface VisualFilters {
  trails: boolean;
  velocityVectors: boolean;
  accelerationVectors: boolean;
  distanceLines: boolean;
  centerOfMass: boolean;
  gravitationalField: boolean;
  backgroundAnimation: boolean;
}

export interface PanelVisibility {
  controlPanel: boolean;            // Visible/collapsed (relevant on tablet/mobile)
  dataPanel: boolean;               // Visible/collapsed
}

export type DataVariable =
  | 'position'
  | 'speed'
  | 'acceleration'
  | 'kineticEnergy'
  | 'potentialEnergy'
  | 'totalEnergy'
  | 'angularMomentum'
  | 'distances'
  | 'centerOfMass'
  | 'totalMomentum';
