import type { BodyState, GlobalConfig } from './simulation';

export type PresetCategory =
  | 'stable'
  | 'chaotic'
  | 'hierarchical'
  | 'choreographic'
  | 'collision';

export interface Preset {
  id: string;                       // Unique kebab-case identifier
  name: string;                     // Display name
  description: string;              // 1-2 sentence explanation
  category: PresetCategory;
  bodies: [BodyState, BodyState, BodyState];
  globals: GlobalConfig;
  seed: string;                     // Pre-computed seed for this preset
}
