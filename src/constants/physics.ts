// ─── Physics Engine Constants ───
// All values are configurable — change here to affect the entire simulation.
// See specs/PHYSICS.md §6 and specs/SPECS.md §12 for rationale.

/** Fixed physics timestep in simulation time units (AU time). */
export const BASE_DT = 0.001;

/** Maximum physics steps per animation frame — prevents spiral-of-death on lag.
 *  Must accommodate 10× speed at 60fps: ceil(16.67ms / 1000 * 10 / 0.001) ≈ 167 steps/frame. */
export const MAX_STEPS_PER_FRAME = 200;

/** Converts wall-clock seconds to simulation time units. 1.0 = 1 real second → 1 AU time. */
export const TIME_SCALE = 1.0;

/** Auto-pause threshold: body is considered ejected when |x| or |y| exceeds this (AU). */
export const HARD_BOUNDARY = 1000;

/** Relative energy drift fraction that triggers the instability warning UI. */
export const ENERGY_DRIFT_WARNING = 0.10;

/** Absolute energy drift (AU units) used as a fallback when initial energy is near zero. */
export const ENERGY_DRIFT_ABSOLUTE = 1.0;

/** Reference speed (AU/time) used for velocity-based visual scaling. */
export const SPEED_REFERENCE = 2.0;

/** Visual radius (px) of a mass-1 body before mass scaling is applied. */
export const BASE_RADIUS_PX = 8;
