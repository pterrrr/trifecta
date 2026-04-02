import type { Viewport } from '../viewport';
import type { RenderState } from '../renderLoop';
import { worldToCanvas } from '../viewport';
import { SPEED_REFERENCE } from '../../constants/physics';

// Body base colors as RGB components (DESIGN.md §3.1)
const BODY_COLORS = [
  { r: 255, g: 51, b: 51 },  // Body R: #ff3333
  { r: 51, g: 255, b: 102 }, // Body G: #33ff66
  { r: 51, g: 102, b: 255 }, // Body B: #3366ff
];

const BASE_TRAIL_OPACITY = 0.7;
const BASE_TRAIL_WIDTH = 2.0;

// ─── Active Body Focus (DESIGN.md §8.1) ───────────────────────────────────────
// Non-focused trails render at ×0.4 opacity. Uses same lerp rates as BodyLayer.
const FOCUS_IN_RATE = 5.0;   // 0→1 in 200ms
const FOCUS_OUT_RATE = 2.5;  // 1→0 in 400ms
const NON_FOCUSED_TRAIL_DIM = 0.6; // dims to ×0.4 (dim by 0.6)

const BODY_ID_TO_INDEX: Record<string, number> = { r: 0, g: 1, b: 2 };

// Module-level state — persists across frames, updated by drawTrails each frame.
let focusIntensity = 0;
let visualFocusIdx = -1;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Draw trail polylines for each body.
 * Per-segment lineCap='round' with tapered width and speed-based opacity.
 * See DESIGN.md §3.4, §5.
 *
 * When activeBodyFocus is set (DESIGN.md §8.1):
 *   Non-focused body trails render at ×0.4 opacity.
 */
export function drawTrails(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
  deltaTime: number,
): void {
  const { canvasWidth: w, canvasHeight: h } = viewport;
  ctx.clearRect(0, 0, w, h);

  if (!state.filters.trails) return;

  const { trailHistory, bodies, dpr, activeBodyFocus } = state;

  // ── Update focus intensity (mirrors BodyLayer rate for sync) ─────────────
  const targetFocusIdx = activeBodyFocus !== null ? BODY_ID_TO_INDEX[activeBodyFocus] : -1;
  if (targetFocusIdx !== -1) {
    visualFocusIdx = targetFocusIdx;
    focusIntensity = Math.min(1, focusIntensity + deltaTime * FOCUS_IN_RATE);
  } else {
    focusIntensity = Math.max(0, focusIntensity - deltaTime * FOCUS_OUT_RATE);
    if (focusIntensity <= 0) visualFocusIdx = -1;
  }

  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'source-over';

  for (let bodyIdx = 0; bodyIdx < 3; bodyIdx++) {
    const trail = trailHistory[bodyIdx];
    if (trail.length < 2) continue;

    const body = bodies[bodyIdx];
    const color = BODY_COLORS[bodyIdx];

    // Mass-based max width (DESIGN.md §3.4): width = BASE × m^(1/4)
    const headWidth = BASE_TRAIL_WIDTH * Math.pow(body.mass, 0.25) * dpr;

    // Speed-based brightness (DESIGN.md §3.4)
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
    const speedFactor = clamp(speed / SPEED_REFERENCE, 0.3, 1.5);
    const baseOpacity = BASE_TRAIL_OPACITY * speedFactor;

    // Focus dim: non-focused trails → ×0.4 (DESIGN.md §8.1)
    const isNonFocused = visualFocusIdx !== -1 && visualFocusIdx !== bodyIdx;
    const trailDimMult = isNonFocused
      ? 1 - NON_FOCUSED_TRAIL_DIM * focusIntensity
      : 1;

    const len = trail.length;
    // Tier-aware base sampling step: reduces draw calls on tablet/mobile (DESIGN.md §14)
    const baseSampleStep = (state.responsiveTier === 'mobile' && len > 200) ? 3
      : (state.responsiveTier === 'tablet' && len > 300) ? 2 : 1;

    // Desktop optimization: sample every 2nd point for the older half when trail
    // exceeds 500 points. The older half fades to near-transparent so the visual
    // loss is imperceptible while halving draw calls for that portion. (SPECS.md §perf)
    const TRAIL_SAMPLE_THRESHOLD = 500;
    const halfLen = Math.floor(len / 2);

    let i = 0;
    while (i < len - 1) {
      // In the older half of a long desktop trail, step by 2 to cut draw calls
      const isOlderHalfDesktop = state.responsiveTier === 'desktop'
        && len > TRAIL_SAMPLE_THRESHOLD
        && i < halfLen;
      const step = isOlderHalfDesktop ? Math.max(baseSampleStep, 2) : baseSampleStep;

      const nextIdx = Math.min(i + step, len - 1);

      // progress: 0.0 at tail (oldest), 1.0 at head (newest)
      const progress = i / (len - 1);

      // Width taper: 30% at tail → 100% at head (DESIGN.md §5.3)
      const segWidth = headWidth * (0.3 + 0.7 * progress);

      // Opacity fade: 0 at tail → baseOpacity at head, dimmed if non-focused
      const opacity = baseOpacity * progress * trailDimMult;

      if (opacity >= 0.01) {
        const p1 = worldToCanvas(trail[i].position.x, trail[i].position.y, viewport);
        const p2 = worldToCanvas(trail[nextIdx].position.x, trail[nextIdx].position.y, viewport);

        ctx.lineWidth = segWidth;
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      i += step;
    }
  }
}
