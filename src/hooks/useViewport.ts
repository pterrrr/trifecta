import { useRef, useCallback } from 'react';
import type { BodyState } from '../types';
import type { Viewport } from '../renderer/viewport';
import { computeTargetViewport, lerpViewport, setLastRenderedViewport } from '../renderer/viewport';

const VIEWPORT_LERP_FACTOR = 0.05;

/**
 * Hook that computes target viewport each frame and lerps current → target.
 * Returns a stable `update` function to be called from the render loop.
 *
 * The viewport smoothly tracks the bodies as they move,
 * auto-scaling to keep all three visible with padding.
 */
export function useViewport() {
  const viewportRef = useRef<Viewport | null>(null);

  const update = useCallback(
    (
      bodies: [BodyState, BodyState, BodyState],
      canvasWidth: number,
      canvasHeight: number,
    ): Viewport => {
      const target = computeTargetViewport(bodies, canvasWidth, canvasHeight, 0.2);

      if (!viewportRef.current) {
        // First frame: snap to target (no lerp)
        viewportRef.current = target;
      } else {
        viewportRef.current = lerpViewport(
          viewportRef.current,
          target,
          VIEWPORT_LERP_FACTOR,
        );
      }

      setLastRenderedViewport(viewportRef.current);
      return viewportRef.current;
    },
    [],
  );

  const reset = useCallback(() => {
    viewportRef.current = null;
  }, []);

  return { update, reset };
}
