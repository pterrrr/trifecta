import type { BodyState } from '../types/simulation';

// ─── Viewport Interface ───

export interface Viewport {
  centerX: number;      // World-space center X (AU)
  centerY: number;      // World-space center Y (AU)
  scale: number;        // Pixels per AU
  canvasWidth: number;  // Canvas pixel width (accounting for dpr)
  canvasHeight: number; // Canvas pixel height (accounting for dpr)
}

// ─── Viewport Computation ───

/**
 * Compute the target viewport to fit all bodies with padding.
 * Returns the target — actual viewport lerps toward this each frame.
 */
export function computeTargetViewport(
  bodies: [BodyState, BodyState, BodyState],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 0.2,
): Viewport {
  const xs = bodies.map((b) => b.position.x);
  const ys = bodies.map((b) => b.position.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Ensure a minimum span so bodies at the same position don't produce scale=Infinity
  const spanX = Math.max(maxX - minX, 0.1);
  const spanY = Math.max(maxY - minY, 0.1);

  const paddedSpanX = spanX * (1 + 2 * padding);
  const paddedSpanY = spanY * (1 + 2 * padding);

  // Use the smaller scale so both axes fit within the canvas
  const scaleX = canvasWidth / paddedSpanX;
  const scaleY = canvasHeight / paddedSpanY;
  const scale = Math.min(scaleX, scaleY);

  return { centerX, centerY, scale, canvasWidth, canvasHeight };
}

/**
 * Lerp current viewport toward target.
 * lerpFactor controls smoothness (0.05 = slow/smooth, 0.2 = fast/responsive).
 */
export function lerpViewport(
  current: Viewport,
  target: Viewport,
  lerpFactor: number,
): Viewport {
  return {
    centerX: current.centerX + (target.centerX - current.centerX) * lerpFactor,
    centerY: current.centerY + (target.centerY - current.centerY) * lerpFactor,
    scale: current.scale + (target.scale - current.scale) * lerpFactor,
    canvasWidth: target.canvasWidth,
    canvasHeight: target.canvasHeight,
  };
}

// ─── Shared Viewport Cache ───

/**
 * Module-level cache of the last rendered viewport.
 * Written by useViewport each frame; read by CanvasStack for drag coordinate conversion.
 */
export let lastRenderedViewport: Viewport | null = null;

export function setLastRenderedViewport(viewport: Viewport): void {
  lastRenderedViewport = viewport;
}

// ─── Coordinate Transforms ───

/**
 * Convert world-space coordinates (AU) to canvas pixel coordinates.
 * Canvas Y-axis is flipped relative to world Y (canvas Y increases downward).
 */
export function worldToCanvas(
  wx: number,
  wy: number,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (wx - viewport.centerX) * viewport.scale + viewport.canvasWidth / 2,
    y: -(wy - viewport.centerY) * viewport.scale + viewport.canvasHeight / 2,
  };
}

/**
 * Convert canvas pixel coordinates to world-space coordinates (AU).
 */
export function canvasToWorld(
  cx: number,
  cy: number,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (cx - viewport.canvasWidth / 2) / viewport.scale + viewport.centerX,
    y: -((cy - viewport.canvasHeight / 2) / viewport.scale) + viewport.centerY,
  };
}
