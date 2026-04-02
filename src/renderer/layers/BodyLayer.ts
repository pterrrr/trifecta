import type { Viewport } from '../viewport';
import type { RenderState } from '../renderLoop';
import { worldToCanvas } from '../viewport';
import { BASE_RADIUS_PX } from '../../constants/physics';

// DESIGN.md §3.1
const BODY_BASE_COLORS = ['#ff3333', '#33ff66', '#3366ff'];
// Pre-parsed RGBA components for gradient stops (avoids string parsing per frame)
const BASE_RGB = [
  [255, 51, 51],
  [51, 255, 102],
  [51, 102, 255],
] as const;

const GLOW_RGB = [
  [255, 102, 102],
  [102, 255, 153],
  [102, 153, 255],
] as const;

// DESIGN.md §4.3 — phase offsets so bodies breathe independently
const PHASE_OFFSETS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

// ─── Active Body Focus (DESIGN.md §8.1) ───────────────────────────────────────

// Linear ramp rates: 1/duration_seconds
const FOCUS_IN_RATE = 5.0;   // 0→1 in 200ms (ease-out approximation)
const FOCUS_OUT_RATE = 2.5;  // 1→0 in 400ms (ease-in-out approximation)

// Pulse timing for the highlight ring
const RING_PULSE_PERIOD = 1.5;  // seconds
const RING_PULSE_CENTER = 0.6;  // mid opacity
const RING_PULSE_AMP = 0.1;     // ±amplitude → oscillates 50%–70%

// Modifier targets at full intensity
const FOCUSED_GLOW_BOOST = 0.5;        // ×1.5 glow at full focus
const NON_FOCUSED_BODY_DIM = 0.5;      // ×0.5 body opacity at full focus
const NON_FOCUSED_GLOW_DIM = 0.7;      // ×0.3 glow opacity at full focus (dim by 0.7)

const BODY_ID_TO_INDEX: Record<string, number> = { r: 0, g: 1, b: 2 };

// Module-level state — persists across frames, updated by drawBodies each frame.
// visualFocusIdx stays at the last-focused body while intensity fades out,
// so the dimming/highlight transitions smoothly back to normal instead of snapping.
let focusIntensity = 0;
let visualFocusIdx = -1; // body index currently being visually highlighted/dimming

/**
 * Draw bodies with 3-layer radial gradient glow (DESIGN.md §4.2) and
 * subtle pulse animation (DESIGN.md §4.3).
 *
 * When activeBodyFocus is set (DESIGN.md §8.1):
 *   - Focused body: glow ×1.5, highlight ring with pulse
 *   - Non-focused bodies: body opacity ×0.5, glow opacity ×0.3
 *
 * Glow layers use globalCompositeOperation = 'lighter' so overlapping glows
 * from nearby bodies blend additively, reinforcing the RGB color system.
 */
export function drawBodies(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
  deltaTime: number,
): void {
  const { canvasWidth: w, canvasHeight: h } = viewport;
  ctx.clearRect(0, 0, w, h);

  const { bodies, dpr, activeBodyFocus } = state;

  // Wall-clock time in seconds — pulse is a purely visual effect
  const time = performance.now() / 1000;

  // ── Update focus intensity (linear ramp, simulates ease-in/out) ────────────
  // visualFocusIdx persists while fading out so the dim/highlight transitions
  // smoothly back to normal rather than snapping when focus is cleared.
  const targetFocusIdx = activeBodyFocus !== null ? BODY_ID_TO_INDEX[activeBodyFocus] : -1;
  if (targetFocusIdx !== -1) {
    visualFocusIdx = targetFocusIdx;
    focusIntensity = Math.min(1, focusIntensity + deltaTime * FOCUS_IN_RATE);
  } else {
    focusIntensity = Math.max(0, focusIntensity - deltaTime * FOCUS_OUT_RATE);
    if (focusIntensity <= 0) visualFocusIdx = -1;
  }

  for (let i = 0; i < 3; i++) {
    const body = bodies[i];
    const pos = worldToCanvas(body.position.x, body.position.y, viewport);

    // DESIGN.md §4.1
    const baseRadius = Math.max(2 * dpr, BASE_RADIUS_PX * Math.cbrt(body.mass) * dpr);

    // DESIGN.md §4.3 — pulse factor (disabled when reduced motion is active, §13.3)
    const pulseFactor = state.reducedMotion
      ? 1.0
      : 1.0 + 0.05 * Math.sin(time * 2.0 + PHASE_OFFSETS[i]);
    const radius = baseRadius * pulseFactor;

    // Inner glow opacity is also modulated by pulse (±5% from base 40%)
    const innerGlowOpacity = 0.4 * pulseFactor;

    const [gr, gg, gb] = GLOW_RGB[i];
    const [br, bg, bb] = BASE_RGB[i];

    // ── Focus modifiers (DESIGN.md §8.1) ─────────────────────────────────────
    const isFocused = visualFocusIdx === i;
    const isNonFocused = visualFocusIdx !== -1 && !isFocused;

    // Glow boost for focused body: lerp 1.0 → 1.5
    const glowMult = isFocused
      ? 1 + FOCUSED_GLOW_BOOST * focusIntensity
      : 1;

    // Dim multipliers for non-focused bodies
    const bodyAlpha = isNonFocused
      ? 1 - NON_FOCUSED_BODY_DIM * focusIntensity
      : 1;
    const glowAlpha = isNonFocused
      ? 1 - NON_FOCUSED_GLOW_DIM * focusIntensity
      : 1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowAlpha;

    // ── Layer 1: inner glow (radius × 2.5) ──────────────────────────────
    {
      const r = radius * 2.5;
      const opacity = innerGlowOpacity * glowMult;
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      grad.addColorStop(0, `rgba(${gr},${gg},${gb},${opacity.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Layer 2: outer glow (radius × 5.0) ──────────────────────────────
    {
      const r = radius * 5.0;
      const opacity = 0.15 * glowMult;
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      grad.addColorStop(0, `rgba(${gr},${gg},${gb},${opacity.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Layer 3: ambient halo (radius × 8.0) — skipped on tablet/mobile (DESIGN.md §14)
    if (state.responsiveTier === 'desktop') {
      const r = radius * 8.0;
      const opacity = 0.05 * glowMult;
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      grad.addColorStop(0, `rgba(${br},${bg},${bb},${opacity.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();

    // ── Solid body circle (drawn on top of glow layers) ──────────────────
    ctx.save();
    ctx.globalAlpha = bodyAlpha;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = BODY_BASE_COLORS[i];
    ctx.fill();
    ctx.restore();

    // ── Highlight ring (focused body only, DESIGN.md §8.1) ───────────────
    if (isFocused && focusIntensity > 0.01) {
      const ringPulse =
        RING_PULSE_CENTER +
        RING_PULSE_AMP * Math.sin((time * 2 * Math.PI) / RING_PULSE_PERIOD);
      const ringOpacity = ringPulse * focusIntensity;
      const ringRadius = baseRadius + 4 * dpr;

      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${br},${bg},${bb},${ringOpacity.toFixed(3)})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  }
}
