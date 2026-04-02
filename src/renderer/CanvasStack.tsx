import { useEffect, useRef } from 'react';
import type { CanvasLayerRefs } from './renderLoop';
import { canvasToWorld, worldToCanvas, lastRenderedViewport } from './viewport';
import { useStore } from '../state/store';
import type { BodyId } from '../types';
import { BASE_RADIUS_PX } from '../constants/physics';

interface CanvasStackProps {
  onRefsReady: (refs: CanvasLayerRefs) => void;
}

/**
 * Hit-test radius: inner glow radius (2.5×) gives a generous but precise target.
 * Matches the first glow layer drawn in BodyLayer.ts.
 */
function getBodyHitRadius(mass: number, dpr: number): number {
  return Math.max(2 * dpr, BASE_RADIUS_PX * Math.cbrt(mass) * dpr) * 2.5;
}

/**
 * Creates and manages four stacked <canvas> elements:
 *   background (z0), trail (z1), body (z2), effect (z3).
 *
 * All share dimensions, positioned absolutely on top of each other.
 * Rendering is imperative — driven by useSimulationLoop, not React state.
 * See ARCHITECTURE.md §7.1.
 *
 * In Lab Mode while paused, the effect canvas (topmost) also handles
 * body-drag interactions (§3.4).
 */
export function CanvasStack({ onRefsReady }: CanvasStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const effectRef = useRef<HTMLCanvasElement>(null);

  // Tracks which body is being dragged (null when idle)
  const draggingBodyRef = useRef<BodyId | null>(null);

  // ─── Canvas resize / setup ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const bgCanvas = bgRef.current;
    const trailCanvas = trailRef.current;
    const bodyCanvas = bodyRef.current;
    const effectCanvas = effectRef.current;

    if (!container || !bgCanvas || !trailCanvas || !bodyCanvas || !effectCanvas) return;

    const canvases = [bgCanvas, trailCanvas, bodyCanvas, effectCanvas];

    const bgCtx = bgCanvas.getContext('2d');
    const trailCtx = trailCanvas.getContext('2d');
    const bodyCtx = bodyCanvas.getContext('2d');
    const effectCtx = effectCanvas.getContext('2d');

    if (!bgCtx || !trailCtx || !bodyCtx || !effectCtx) return;

    function resize() {
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      // Square canvas: take the smaller dimension to maintain 1:1 aspect ratio
      const size = Math.min(width, height);

      for (const canvas of canvases) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    onRefsReady({
      background: bgCtx,
      trail: trailCtx,
      body: bodyCtx,
      effect: effectCtx,
    });

    return () => ro.disconnect();
  }, [onRefsReady]);

  // ─── Drag: global mousemove / mouseup (always attached, no-ops when idle) ─
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      const bodyId = draggingBodyRef.current;
      if (!bodyId) return;

      const canvas = effectRef.current;
      const viewport = lastRenderedViewport;
      if (!canvas || !viewport) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cx = (e.clientX - rect.left) * dpr;
      const cy = (e.clientY - rect.top) * dpr;

      const worldPos = canvasToWorld(cx, cy, viewport);
      // Clamp to the allowed position range (§1.1)
      const x = Math.max(-10, Math.min(10, worldPos.x));
      const y = Math.max(-10, Math.min(10, worldPos.y));

      useStore.getState().dragBodyPosition(bodyId, { x, y });
    };

    const onWindowMouseUp = () => {
      if (!draggingBodyRef.current) return;
      draggingBodyRef.current = null;
      if (effectRef.current) effectRef.current.style.cursor = '';
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, []);

  // ─── Drag: canvas event handlers ─────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { mode, isPlaying, bodies } = useStore.getState();
    if (mode !== 'lab' || isPlaying) return;

    const canvas = effectRef.current;
    const viewport = lastRenderedViewport;
    if (!canvas || !viewport) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cx = (e.clientX - rect.left) * dpr;
    const cy = (e.clientY - rect.top) * dpr;

    for (const body of bodies) {
      const bPos = worldToCanvas(body.position.x, body.position.y, viewport);
      const hitRadius = getBodyHitRadius(body.mass, dpr);
      const dx = cx - bPos.x;
      const dy = cy - bPos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        draggingBodyRef.current = body.id;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If already dragging, window-level handler does the work
    if (draggingBodyRef.current) return;

    // Otherwise update hover cursor
    const canvas = effectRef.current;
    if (!canvas) return;

    const { mode, isPlaying, bodies } = useStore.getState();
    if (mode !== 'lab' || isPlaying) {
      canvas.style.cursor = '';
      return;
    }

    const viewport = lastRenderedViewport;
    if (!viewport) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cx = (e.clientX - rect.left) * dpr;
    const cy = (e.clientY - rect.top) * dpr;

    for (const body of bodies) {
      const bPos = worldToCanvas(body.position.x, body.position.y, viewport);
      const hitRadius = getBodyHitRadius(body.mass, dpr);
      const dx = cx - bPos.x;
      const dy = cy - bPos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        canvas.style.cursor = 'grab';
        return;
      }
    }

    canvas.style.cursor = '';
  };

  const handleMouseLeave = () => {
    // Clear hover cursor; dragging continues via window listeners
    if (!draggingBodyRef.current && effectRef.current) {
      effectRef.current.style.cursor = '';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <canvas ref={bgRef} style={{ ...canvasStyle, zIndex: 0 }} />
      <canvas ref={trailRef} style={{ ...canvasStyle, zIndex: 1 }} />
      <canvas ref={bodyRef} style={{ ...canvasStyle, zIndex: 2 }} />
      <canvas
        ref={effectRef}
        style={{ ...canvasStyle, zIndex: 3 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
