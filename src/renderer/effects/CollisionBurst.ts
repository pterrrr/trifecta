import type { CollisionEvent, BodyPair, Vector2D } from '../../types';
import type { Viewport } from '../viewport';
import { worldToCanvas } from '../viewport';
import { SPEED_REFERENCE } from '../../constants/physics';

// ─── Burst Colors (DESIGN.md §7.1) ───
// Manually tuned additive mixes — not pure additive, warmer/more appealing.

const BURST_COLORS: Record<BodyPair, [number, number, number]> = {
  rg: [255, 204, 51],   // Yellow
  rb: [255, 51, 255],   // Magenta
  gb: [51, 255, 255],   // Cyan
};

// ─── Ring colors at 80% saturation (DESIGN.md §7.2 Layer 2) ───
// Desaturated by mixing 80% of burst color with 20% of its luminance gray.

function desaturate80(color: [number, number, number]): [number, number, number] {
  const gray = Math.round(0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]);
  return [
    Math.round(color[0] * 0.8 + gray * 0.2),
    Math.round(color[1] * 0.8 + gray * 0.2),
    Math.round(color[2] * 0.8 + gray * 0.2),
  ];
}

const RING_COLORS: Record<BodyPair, [number, number, number]> = {
  rg: desaturate80(BURST_COLORS.rg),
  rb: desaturate80(BURST_COLORS.rb),
  gb: desaturate80(BURST_COLORS.gb),
};

// ─── Easing ───

function easeOut(t: number): number {
  // cubic-bezier(0, 0, 0.2, 1) approximation
  return 1 - Math.pow(1 - t, 3);
}

// ─── Particle ───

interface BurstParticle {
  angle: number;
  speed: number;
  size: number;
  opacity: number;
  lifetime: number;  // ms
  age: number;       // ms
}

// ─── Pair → body indices ───

const PAIR_INDICES: Record<BodyPair, [number, number]> = {
  rg: [0, 1],
  rb: [0, 2],
  gb: [1, 2],
};

// ─── CollisionBurst Class (ARCHITECTURE.md §13.2) ───

export class CollisionBurst {
  readonly pair: BodyPair;
  readonly position: Vector2D;
  readonly intensity: number;
  readonly color: [number, number, number];
  readonly ringColor: [number, number, number];
  readonly maxAge: number;

  age: number = 0;

  private particles: BurstParticle[];
  private baseThreshold: number;

  /**
   * @param event        The collision event from the physics engine.
   * @param threshold    Actual collision threshold (AU) from the detection function,
   *                     computed from real body masses. Used to scale burst radii.
   */
  constructor(event: CollisionEvent, threshold: number) {
    this.pair = event.pair;
    this.position = { x: event.point.x, y: event.point.y };
    this.color = BURST_COLORS[event.pair];
    this.ringColor = RING_COLORS[event.pair];

    // Intensity scaling (DESIGN.md §7.3)
    this.intensity = Math.max(0.3, Math.min(2.0, event.relativeSpeed / SPEED_REFERENCE));

    this.baseThreshold = threshold;

    // Max age: longest-lived layer is the particle scatter (up to 500ms)
    // but the ring lasts 400ms. Use 600ms as safe upper bound.
    this.maxAge = 600;

    // Particle scatter (DESIGN.md §7.2 Layer 3)
    const particleCount = Math.min(24, 8 + Math.floor(event.relativeSpeed * 4));
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 1.5) * event.relativeSpeed;
      this.particles.push({
        angle,
        speed,
        size: 1.0 + Math.random() * 1.5,
        opacity: 0.8,
        lifetime: 200 + Math.random() * 300,
        age: 0,
      });
    }
  }

  /**
   * Advance burst age by deltaTime (seconds).
   * Returns false when the burst has fully expired and should be removed.
   */
  update(deltaTime: number): boolean {
    const dtMs = deltaTime * 1000;
    this.age += dtMs;
    for (const p of this.particles) {
      p.age += dtMs;
    }
    return this.age < this.maxAge;
  }

  /**
   * Render the burst onto the effect canvas.
   * When reducedMotion is true, only the flash core is drawn (DESIGN.md §13.3).
   */
  draw(ctx: CanvasRenderingContext2D, viewport: Viewport, reducedMotion = false): void {
    const { x: cx, y: cy } = worldToCanvas(this.position.x, this.position.y, viewport);
    const scale = viewport.scale;
    const intensity = this.intensity;
    const [cr, cg, cb] = this.color;
    const [rr, rg, rb] = this.ringColor;

    // All radii in the spec are in world units (multiples of collisionThreshold),
    // converted to pixels via viewport.scale.
    const baseR = this.baseThreshold * scale;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // ─── Layer 1: Flash Core (150ms, ease-out) ───
    if (this.age < 150) {
      const t = easeOut(this.age / 150);
      const minR = baseR * 0.5;
      const maxR = baseR * 3.0 * intensity;
      const radius = minR + (maxR - minR) * t;
      const opacity = (0.9 - 0.9 * t) * Math.min(intensity, 1.0);

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(radius, 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${opacity.toFixed(3)})`;
      ctx.fill();
    }

    // ─── Layer 2: Expanding Ring (400ms, ease-out, 80% saturation color) ───
    if (!reducedMotion && this.age < 400) {
      const t = easeOut(this.age / 400);
      const minR = baseR * 1.0;
      const maxR = baseR * 6.0 * intensity;
      const radius = minR + (maxR - minR) * t;
      const strokeWidth = 3 - 2.5 * t; // 3px → 0.5px
      const opacity = (0.7 - 0.7 * t) * Math.min(intensity, 1.0);

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(radius, 1), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rr},${rg},${rb},${opacity.toFixed(3)})`;
      ctx.lineWidth = Math.max(strokeWidth, 0.5);
      ctx.stroke();
    }

    // ─── Layer 3: Particle Scatter ───
    if (reducedMotion) { ctx.restore(); return; }
    for (const p of this.particles) {
      if (p.age >= p.lifetime) continue;

      const t = p.age / p.lifetime;
      const opacity = p.opacity * (1 - t) * Math.min(intensity, 1.0);
      // Distance traveled in world units, converted to pixels
      const dist = p.speed * (p.age / 1000) * scale;
      const px = cx + Math.cos(p.angle) * dist;
      const py = cy + Math.sin(p.angle) * dist;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${opacity.toFixed(3)})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Returns the background tint pulse parameters for this burst (DESIGN.md §7.4).
   * Returns null if the tint phase (first 150ms) has elapsed.
   */
  getTintPulse(): { r: number; g: number; b: number; opacity: number } | null {
    if (this.age >= 150) return null;
    const t = easeOut(this.age / 150);
    const opacity = 0.05 * this.intensity * (1 - t);
    // Cap at 0.10 per spec
    return {
      r: this.color[0],
      g: this.color[1],
      b: this.color[2],
      opacity: Math.min(opacity, 0.10),
    };
  }
}

/** Map a BodyPair to its two body indices in the bodies array. */
export { PAIR_INDICES };
