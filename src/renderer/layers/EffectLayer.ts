import type { Viewport } from '../viewport';
import type { RenderState } from '../renderLoop';
import type { CollisionEvent, BodyPair } from '../../types';
import { CollisionBurst, PAIR_INDICES } from '../effects/CollisionBurst';
import { worldToCanvas, canvasToWorld } from '../viewport';

// ─── Body base colors (DESIGN.md §3.1) ───
const BASE_RGB = [
  [255, 51, 51],    // Body R
  [51, 255, 102],   // Body G
  [51, 102, 255],   // Body B
] as const;

// ─── Collision threshold (mirrors useSimulationLoop) ───
const COLLISION_FACTOR = 0.02;
function collisionThresholdFromMasses(massA: number, massB: number): number {
  return COLLISION_FACTOR * (Math.cbrt(massA) + Math.cbrt(massB));
}

// ─── Active Burst Management ───
let activeBursts: CollisionBurst[] = [];
const processedCollisions = new Set<string>();

function collisionKey(event: CollisionEvent): string {
  return `${event.pair}:${event.timestamp}`;
}

// ─── Gravitational Field Cache (DESIGN.md §9.5) ───
const FIELD_GRID = 40;
const FIELD_UPDATE_INTERVAL = 5; // update every 5th frame (~12Hz at 60fps)
let fieldFrameCounter = 0;
interface FieldCell { r: number; g: number; b: number; a: number; }
let cachedField: FieldCell[] = [];

/**
 * Reset all burst and field state — call on simulation reset.
 */
export function resetEffects(): void {
  activeBursts = [];
  processedCollisions.clear();
  fieldFrameCounter = 0;
  cachedField = [];
}

// ─── Arrow Helper (DESIGN.md §9.1, §9.2) ───

/**
 * Draw a line from (fromX, fromY) to (toX, toY) with a filled arrowhead at the tip.
 * Assumes ctx already has strokeStyle, fillStyle, lineWidth, and lineDash configured.
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  arrowHeadLen: number,
  arrowHeadWidth: number,
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 2) return;

  const ux = dx / length;
  const uy = dy / length;

  // Base of arrowhead
  const baseX = toX - ux * arrowHeadLen;
  const baseY = toY - uy * arrowHeadLen;

  // Perpendicular offset for arrowhead width
  const px = -uy * (arrowHeadWidth / 2);
  const py =  ux * (arrowHeadWidth / 2);

  // Stem
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();

  // Arrowhead (filled — unaffected by lineDash)
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(baseX + px, baseY + py);
  ctx.lineTo(baseX - px, baseY - py);
  ctx.closePath();
  ctx.fill();
}

// ─── §9.1 Velocity Vectors ───

function drawVelocityVectors(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
): void {
  const VECTOR_SCALE = 30; // px per AU/time (DESIGN.md §9.1)
  const MAX_LEN = 100;

  for (let i = 0; i < 3; i++) {
    const body = state.bodies[i];
    const [r, g, b] = BASE_RGB[i];
    const pos = worldToCanvas(body.position.x, body.position.y, viewport);

    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 0.001) continue;

    const rawLen = speed * VECTOR_SCALE;
    const len = Math.min(rawLen, MAX_LEN);
    const scale = len / speed;

    const toX = pos.x + vx * scale;
    const toY = pos.y - vy * scale; // Y-flip for canvas

    ctx.save();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    drawArrow(ctx, pos.x, pos.y, toX, toY, 8, 5);
    ctx.restore();
  }
}

// ─── §9.2 Acceleration Vectors ───

function drawAccelerationVectors(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
): void {
  const ACCEL_SCALE = 15; // px per AU/time² (DESIGN.md §9.2)
  const MAX_LEN = 80;

  for (let i = 0; i < 3; i++) {
    const body = state.bodies[i];
    const [r, g, b] = BASE_RGB[i];
    const pos = worldToCanvas(body.position.x, body.position.y, viewport);
    const accel = state.derived.bodyDerived[i].acceleration;

    const ax = accel.x;
    const ay = accel.y;
    const aMag = Math.sqrt(ax * ax + ay * ay);
    if (aMag < 0.0001) continue;

    const rawLen = aMag * ACCEL_SCALE;
    const len = Math.min(rawLen, MAX_LEN);
    const scale = len / aMag;

    const toX = pos.x + ax * scale;
    const toY = pos.y - ay * scale;

    ctx.save();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    drawArrow(ctx, pos.x, pos.y, toX, toY, 8, 5);
    ctx.restore();
  }
}

// ─── §9.3 Distance Lines ───

const PAIR_BODY_INDICES: [number, number, 'rg' | 'rb' | 'gb'][] = [
  [0, 1, 'rg'],
  [0, 2, 'rb'],
  [1, 2, 'gb'],
];

function drawDistanceLines(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
): void {
  for (const [iA, iB, distKey] of PAIR_BODY_INDICES) {
    const bodyA = state.bodies[iA];
    const bodyB = state.bodies[iB];
    const posA = worldToCanvas(bodyA.position.x, bodyA.position.y, viewport);
    const posB = worldToCanvas(bodyB.position.x, bodyB.position.y, viewport);
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;

    // Average of the two bodies' base colors at 30% opacity
    const [rA, gA, bA] = BASE_RGB[iA];
    const [rB, gB, bB] = BASE_RGB[iB];
    const r = Math.round((rA + rB) / 2);
    const g = Math.round((gA + gB) / 2);
    const b = Math.round((bA + bB) / 2);

    // Dotted line
    ctx.save();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(posA.x, posA.y);
    ctx.lineTo(posB.x, posB.y);
    ctx.stroke();
    ctx.restore();

    // Distance label at midpoint
    const dist = state.derived.distances[distKey];
    const label = dist.toFixed(2);

    ctx.save();
    ctx.font = `10px "JetBrains Mono", "Fira Code", "Consolas", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
    const pad = 3;
    const bgW = metrics.width + pad * 2;
    const bgH = 14;

    // Label background for readability
    ctx.fillStyle = 'rgba(10,10,15,0.7)';
    ctx.fillRect(midX - bgW / 2, midY - bgH / 2, bgW, bgH);

    // Label text
    ctx.fillStyle = '#a0a0b8'; // --color-text-secondary
    ctx.fillText(label, midX, midY);
    ctx.restore();
  }
}

// ─── §9.4 Center of Mass Marker ───

function drawCenterOfMass(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
): void {
  const com = state.derived.centerOfMass;
  const pos = worldToCanvas(com.x, com.y, viewport);
  const ARM = 12;

  ctx.save();
  ctx.strokeStyle = 'rgba(160,160,184,0.6)'; // --color-text-secondary at 60%
  ctx.fillStyle = 'rgba(160,160,184,0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  // Crosshair arms
  ctx.beginPath();
  ctx.moveTo(pos.x - ARM, pos.y);
  ctx.lineTo(pos.x + ARM, pos.y);
  ctx.moveTo(pos.x, pos.y - ARM);
  ctx.lineTo(pos.x, pos.y + ARM);
  ctx.stroke();

  // Small circle
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─── §9.5 Gravitational Field Overlay ───

function computeGravitationalField(
  state: RenderState,
  viewport: Viewport,
): FieldCell[] {
  const { bodies, globals } = state;
  const { canvasWidth: w, canvasHeight: h } = viewport;
  const cellW = w / FIELD_GRID;
  const cellH = h / FIELD_GRID;
  const G = globals.G;
  const eps2 = globals.softening * globals.softening;

  // First pass: compute potentials
  const rawCells: { phi: [number, number, number]; totalPhi: number }[] = [];
  let maxAbsPhi = 0;

  for (let row = 0; row < FIELD_GRID; row++) {
    for (let col = 0; col < FIELD_GRID; col++) {
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      const world = canvasToWorld(cx, cy, viewport);

      let totalPhi = 0;
      const phi: [number, number, number] = [0, 0, 0];

      for (let i = 0; i < 3; i++) {
        const body = bodies[i];
        const dx = world.x - body.position.x;
        const dy = world.y - body.position.y;
        const r2 = dx * dx + dy * dy + eps2;
        phi[i] = -G * body.mass / Math.sqrt(r2);
        totalPhi += phi[i];
      }

      const absPhi = Math.abs(totalPhi);
      if (absPhi > maxAbsPhi) maxAbsPhi = absPhi;
      rawCells.push({ phi, totalPhi });
    }
  }

  if (maxAbsPhi === 0) return [];

  // Second pass: normalize and compute colors
  return rawCells.map(({ phi, totalPhi }) => {
    const opacity = (Math.abs(totalPhi) / maxAbsPhi) * 0.15;
    const totalAbsPhi = Math.abs(phi[0]) + Math.abs(phi[1]) + Math.abs(phi[2]) || 1;

    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 3; i++) {
      const weight = Math.abs(phi[i]) / totalAbsPhi;
      r += BASE_RGB[i][0] * weight;
      g += BASE_RGB[i][1] * weight;
      b += BASE_RGB[i][2] * weight;
    }

    return { r, g, b, a: opacity };
  });
}

function drawGravitationalField(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
): void {
  const { canvasWidth: w, canvasHeight: h } = viewport;
  const cellW = w / FIELD_GRID;
  const cellH = h / FIELD_GRID;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let row = 0; row < FIELD_GRID; row++) {
    for (let col = 0; col < FIELD_GRID; col++) {
      const cell = cachedField[row * FIELD_GRID + col];
      if (!cell || cell.a < 0.001) continue;
      ctx.fillStyle = `rgba(${Math.round(cell.r)},${Math.round(cell.g)},${Math.round(cell.b)},${cell.a.toFixed(4)})`;
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
    }
  }

  ctx.restore();
}

// ─── Main Draw Function ───

/**
 * Draw all effect layer overlays: filter overlays + collision bursts.
 * Called once per frame by renderFrame.
 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  viewport: Viewport,
  deltaTime: number,
): void {
  const { canvasWidth: w, canvasHeight: h } = viewport;
  ctx.clearRect(0, 0, w, h);

  // ─── §9.5 Gravitational Field (throttled to every 3rd frame) ───
  if (state.filters.gravitationalField) {
    fieldFrameCounter++;
    if (fieldFrameCounter % FIELD_UPDATE_INTERVAL === 0) {
      cachedField = computeGravitationalField(state, viewport);
    }
    if (cachedField.length > 0) {
      drawGravitationalField(ctx, viewport);
    }
  }

  // ─── §9.3 Distance Lines (drawn first — behind vectors) ───
  if (state.filters.distanceLines) {
    drawDistanceLines(ctx, state, viewport);
  }

  // ─── §9.1 Velocity Vectors ───
  if (state.filters.velocityVectors) {
    drawVelocityVectors(ctx, state, viewport);
  }

  // ─── §9.2 Acceleration Vectors ───
  if (state.filters.accelerationVectors) {
    drawAccelerationVectors(ctx, state, viewport);
  }

  // ─── §9.4 Center of Mass Marker ───
  if (state.filters.centerOfMass) {
    drawCenterOfMass(ctx, state, viewport);
  }

  // ─── Spawn bursts for new collision events ───
  if (state.activeCollisions) {
    for (const [, event] of state.activeCollisions) {
      const key = collisionKey(event);
      if (!processedCollisions.has(key)) {
        processedCollisions.add(key);
        const [iA, iB] = PAIR_INDICES[event.pair];
        const threshold = collisionThresholdFromMasses(
          state.bodies[iA].mass,
          state.bodies[iB].mass,
        );
        activeBursts.push(new CollisionBurst(event, threshold));
      }
    }
  }

  // ─── Update & cull expired bursts ───
  activeBursts = activeBursts.filter((burst) => burst.update(deltaTime));

  if (processedCollisions.size > 100) {
    const activePairs = new Set(activeBursts.map((b) => b.pair));
    for (const key of processedCollisions) {
      const pair = key.split(':')[0] as BodyPair;
      if (!activePairs.has(pair)) {
        processedCollisions.delete(key);
      }
    }
  }

  if (activeBursts.length === 0) return;

  // ─── Background tint pulse (DESIGN.md §7.4) ───
  for (const burst of activeBursts) {
    const tint = burst.getTintPulse();
    if (tint && tint.opacity > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.opacity.toFixed(4)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ─── Draw all active bursts ───
  for (const burst of activeBursts) {
    burst.draw(ctx, viewport, state.reducedMotion);
  }
}
