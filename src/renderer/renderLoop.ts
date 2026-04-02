import type { BodyState, TrailHistory, SystemDerived, VisualFilters, BodyPair, CollisionEvent, GlobalConfig, ActiveBodyFocus, ResponsiveTier } from '../types';
import type { Viewport } from './viewport';
import { drawBackground } from './layers/BackgroundLayer';
import { drawTrails } from './layers/TrailLayer';
import { drawBodies } from './layers/BodyLayer';
import { drawEffects } from './layers/EffectLayer';

// ─── Canvas Layer Refs ───

export interface CanvasLayerRefs {
  background: CanvasRenderingContext2D;
  trail: CanvasRenderingContext2D;
  body: CanvasRenderingContext2D;
  effect: CanvasRenderingContext2D;
}

// ─── Render State ───
// Minimal projection of the store — only fields the renderer needs.

export interface RenderState {
  bodies: [BodyState, BodyState, BodyState];
  trailHistory: TrailHistory;
  filters: VisualFilters;
  derived: SystemDerived;
  globals: GlobalConfig;
  dpr: number;
  activeCollisions: [BodyPair, CollisionEvent][];
  activeBodyFocus: ActiveBodyFocus;
  reducedMotion: boolean;
  responsiveTier: ResponsiveTier;
}

// ─── Per-Frame Render Orchestration ───

/**
 * Clear and draw each layer in order: background, trails, bodies, effects.
 * Called once per animation frame by useSimulationLoop.
 */
export function renderFrame(
  refs: CanvasLayerRefs,
  state: RenderState,
  viewport: Viewport,
  deltaTime: number,
): void {
  drawBackground(refs.background, state, viewport, deltaTime);
  drawTrails(refs.trail, state, viewport, deltaTime);
  drawBodies(refs.body, state, viewport, deltaTime);
  drawEffects(refs.effect, state, viewport, deltaTime);
}
