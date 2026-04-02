import type { Viewport } from '../viewport';
import type { RenderState } from '../renderLoop';

// ─── Body base colors (DESIGN.md §3.1) ───
// [R, G, B] channels for each body: R=#ff3333, G=#33ff66, B=#3366ff
const BODY_BASE_COLORS: [[number, number, number], [number, number, number], [number, number, number]] = [
  [255, 51, 51],   // Body R
  [51, 255, 102],  // Body G
  [51, 102, 255],  // Body B
];

// ─── Star field (§6.2) ───

interface StarField {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  count: number;
}

let starField: StarField | null = null;

function getStarField(w: number, h: number, count: number): StarField {
  if (starField && starField.width === w && starField.height === h && starField.count === count) {
    return starField;
  }
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 0.5 + Math.random() * 1.0;         // 0.5 – 1.5 px
    const opacity = 0.2 + Math.random() * 0.4;   // 0.2 – 0.6
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.fill();
  }
  starField = { canvas, width: w, height: h, count };
  return starField;
}

// ─── Atmosphere state (lerped across frames, §6.3 + §3.3) ───

const atmosphere = { r: 0, g: 0, b: 0, opacity: 0.03 };
const LERP_FACTOR = 0.02;

// ─── Ambient particles (§6.4) ───

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  wobblePhase: number;
  wobbleFreq: number;
}

let particles: Particle[] | null = null;
let currentParticleCount = -1;

function initParticles(w: number, h: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const speed = 0.01 + Math.random() * 0.04; // 0.01 – 0.05 px/frame
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.5 + Math.random() * 0.5,         // 0.5 – 1.0 px
      opacity: 0.1 + Math.random() * 0.2,      // 0.1 – 0.3
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq: 0.005 + Math.random() * 0.01,
    };
  });
}

// ─── Dominance calculation (§3.3) ───

function normalizeTriple(a: number, b: number, c: number): [number, number, number] {
  const min = Math.min(a, b, c);
  const max = Math.max(a, b, c);
  const range = max - min;
  if (range === 0) return [1 / 3, 1 / 3, 1 / 3];
  return [(a - min) / range, (b - min) / range, (c - min) / range];
}

function computeDominance(state: RenderState): [number, number, number] {
  const { bodies, derived } = state;
  const { distances, bodyDerived } = derived;

  // Normalize mass
  const [nm0, nm1, nm2] = normalizeTriple(bodies[0].mass, bodies[1].mass, bodies[2].mass);

  // Normalize speed
  const [ns0, ns1, ns2] = normalizeTriple(
    bodyDerived[0].speed,
    bodyDerived[1].speed,
    bodyDerived[2].speed,
  );

  // Proximity: 1 / avgDistanceToOthers — guard against zero
  const EPS = 1e-6;
  const proxR = 1 / (((distances.rg + distances.rb) / 2) + EPS);
  const proxG = 1 / (((distances.rg + distances.gb) / 2) + EPS);
  const proxB = 1 / (((distances.rb + distances.gb) / 2) + EPS);
  const [np0, np1, np2] = normalizeTriple(proxR, proxG, proxB);

  return [
    0.5 * nm0 + 0.3 * ns0 + 0.2 * np0,
    0.5 * nm1 + 0.3 * ns1 + 0.2 * np1,
    0.5 * nm2 + 0.3 * ns2 + 0.2 * np2,
  ];
}

// ─── Main draw function ───

/**
 * Draw the background layer: radial gradient vignette (§6.1), static star
 * field (§6.2), dynamic atmosphere tint (§6.3), ambient particles (§6.4).
 * See DESIGN.md §6 and §3.3.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
  _deltaTime: number,
): void {
  const { canvasWidth: w, canvasHeight: h } = viewport;

  ctx.clearRect(0, 0, w, h);

  // §6.1 Radial vignette: center #0a0a0f → edge #000000
  // Radius = 120% of half-diagonal so gradient extends past all corners.
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.sqrt(w * w + h * h) * 0.6;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, '#0a0a0f');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // §6.2 Static star field — count reduced on tablet/mobile (DESIGN.md §14)
  const starCount = state.responsiveTier === 'mobile' ? 80 : state.responsiveTier === 'tablet' ? 120 : 200;
  ctx.drawImage(getStarField(w, h, starCount).canvas, 0, 0);

  // §6.3 Atmosphere tint overlay
  const dominance = computeDominance(state);
  const maxDom = Math.max(dominance[0], dominance[1], dominance[2]);

  // Target color: weighted sum of body base colors by dominance score
  const targetR =
    dominance[0] * BODY_BASE_COLORS[0][0] +
    dominance[1] * BODY_BASE_COLORS[1][0] +
    dominance[2] * BODY_BASE_COLORS[2][0];
  const targetG =
    dominance[0] * BODY_BASE_COLORS[0][1] +
    dominance[1] * BODY_BASE_COLORS[1][1] +
    dominance[2] * BODY_BASE_COLORS[2][1];
  const targetB =
    dominance[0] * BODY_BASE_COLORS[0][2] +
    dominance[1] * BODY_BASE_COLORS[1][2] +
    dominance[2] * BODY_BASE_COLORS[2][2];

  // Opacity in [0.03, 0.12] scaled by max dominance score
  const targetOpacity = 0.03 + maxDom * (0.12 - 0.03);

  // Lerp toward target at lerpFactor=0.02 per frame
  atmosphere.r += (targetR - atmosphere.r) * LERP_FACTOR;
  atmosphere.g += (targetG - atmosphere.g) * LERP_FACTOR;
  atmosphere.b += (targetB - atmosphere.b) * LERP_FACTOR;
  atmosphere.opacity += (targetOpacity - atmosphere.opacity) * LERP_FACTOR;

  const ar = Math.round(atmosphere.r);
  const ag = Math.round(atmosphere.g);
  const ab = Math.round(atmosphere.b);

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(${ar},${ag},${ab},${atmosphere.opacity.toFixed(4)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // §6.4 Ambient particles — disabled on mobile (DESIGN.md §14.2), when reduced motion
  // is active (§13.3), or when the backgroundAnimation filter is off
  const desiredParticleCount = state.responsiveTier === 'mobile' ? 0
    : state.responsiveTier === 'tablet' ? 15 : 30;

  if (desiredParticleCount === 0 || state.reducedMotion || !state.filters.backgroundAnimation) return;

  if (!particles || currentParticleCount !== desiredParticleCount) {
    particles = initParticles(w, h, desiredParticleCount);
    currentParticleCount = desiredParticleCount;
  }

  for (const p of particles) {
    // Sinusoidal wobble perpendicular to drift direction
    p.wobblePhase += p.wobbleFreq;
    p.x += p.vx + Math.sin(p.wobblePhase) * 0.02;
    p.y += p.vy;

    // Wrap at canvas edges
    if (p.x < 0) p.x += w;
    else if (p.x > w) p.x -= w;
    if (p.y < 0) p.y += h;
    else if (p.y > h) p.y -= h;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${ar},${ag},${ab},${p.opacity})`;
    ctx.fill();
  }
}
