import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import type { CanvasLayerRefs, RenderState } from '../renderer/renderLoop';
import { renderFrame } from '../renderer/renderLoop';
import type { ResponsiveTier } from '../types';
import { useViewport } from './useViewport';
import { useReducedMotion } from './useReducedMotion';
import {
  integrateStep,
  computeDerived,
  detectCollisions,
  checkSeparation,
  detectEjections,
  checkEnergyDrift,
} from '../engine';
import { resetEffects } from '../renderer/layers/EffectLayer';
import {
  BASE_DT,
  MAX_STEPS_PER_FRAME,
  TIME_SCALE,
  HARD_BOUNDARY,
  ENERGY_DRIFT_WARNING,
} from '../constants/physics';
import type { BodyPair, BodyState, CollisionEvent } from '../types';

const GRAPH_INTERVAL_MS = 100; // 10Hz graph sampling

// Collision threshold: sum of visual radii in AU (see PHYSICS.md §9)
const COLLISION_FACTOR = 0.02;
const collisionThresholdFn = (massA: number, massB: number): number =>
  COLLISION_FACTOR * (Math.cbrt(massA) + Math.cbrt(massB));
const separationThresholdFn = (massA: number, massB: number): number =>
  1.5 * collisionThresholdFn(massA, massB);

/**
 * Mutable timing refs threaded through processSimulationFrame between calls.
 * Mirrors accumulatorRef and lastGraphUpdateRef in the animation loop.
 */
export interface FrameRefs {
  accumulator: number;
  lastGraphUpdate: number;
  /** Cached initial total energy — computed once per run, reused every frame. */
  cachedInitialEnergy: number | null;
}

/**
 * Pure-ish per-frame physics pipeline — reads from and writes to the Zustand
 * store, but has no dependency on requestAnimationFrame or React hooks.
 * Extracted so it can be unit-tested directly (see tests/state/store.integration.test.ts).
 *
 * @param wallElapsed  Wall-clock milliseconds since the last frame (capped at 100ms).
 * @param timestamp    Monotonic timestamp for the current frame (used for graph throttle).
 * @param refs         Mutable accumulator and last-graph-update state (updated in-place).
 * @returns stepsExecuted and whether any physics actually ran this frame.
 */
export function processSimulationFrame(
  wallElapsed: number,
  timestamp: number,
  refs: FrameRefs,
): { stepsExecuted: number; physicsRan: boolean } {
  const store = useStore.getState();
  const { bodies, globals, time, isPlaying, speed, derived, initialConditions } = store;

  if (!isPlaying) return { stepsExecuted: 0, physicsRan: false };

  // Cache initial energy: computeDerived is expensive (11 sqrts, 3 force evals).
  // initialConditions is stable for the entire run, so compute once and reuse.
  if (refs.cachedInitialEnergy === null) {
    refs.cachedInitialEnergy = computeDerived(
      initialConditions.bodies as [BodyState, BodyState, BodyState],
      initialConditions.globals,
    ).totalEnergy;
  }
  const initialEnergy = refs.cachedInitialEnergy;

  // Timestep accumulator (PHYSICS.md §6.2)
  const simElapsed = (wallElapsed / 1000) * speed * TIME_SCALE;
  const totalSim = simElapsed + refs.accumulator;
  const stepsNeeded = Math.floor(totalSim / BASE_DT);
  const stepsToRun = Math.min(stepsNeeded, MAX_STEPS_PER_FRAME);
  refs.accumulator = totalSim - stepsToRun * BASE_DT;

  if (stepsToRun === 0) return { stepsExecuted: 0, physicsRan: false };

  let currentBodies: [BodyState, BodyState, BodyState] = bodies;
  let currentTime = time;
  let currentDerived = derived;
  const localCooldowns = new Set<BodyPair>(store.collisionCooldowns as BodyPair[]);
  const newCollisions: CollisionEvent[] = [];
  let ejected = false;

  for (let step = 0; step < stepsToRun; step++) {
    // 1. Integrate
    const nextBodies = integrateStep(currentBodies, globals, BASE_DT);
    currentTime += BASE_DT;

    // 2. Compute derived
    currentDerived = computeDerived(nextBodies, globals);

    // 3. Detect collisions
    const events = detectCollisions(
      currentBodies,
      nextBodies,
      localCooldowns,
      collisionThresholdFn,
    );
    for (const event of events) {
      event.timestamp = currentTime;
      newCollisions.push(event);
      localCooldowns.add(event.pair);
    }

    // Check separation for cooldown exit
    for (const pair of Array.from(localCooldowns)) {
      if (checkSeparation(nextBodies, pair, separationThresholdFn)) {
        localCooldowns.delete(pair);
      }
    }

    // 4. Detect ejections
    const ejectedBodies = detectEjections(nextBodies, HARD_BOUNDARY);
    if (ejectedBodies.length > 0) {
      currentBodies = nextBodies;
      ejected = true;
      break;
    }

    // 5. Check energy drift (diagnostic only for now)
    checkEnergyDrift(
      currentDerived.totalEnergy,
      initialEnergy,
      ENERGY_DRIFT_WARNING,
    );

    currentBodies = nextBodies;
  }

  // After all steps: write results to store
  store.applyNextState({ bodies: currentBodies, globals, time: currentTime });
  useStore.setState({ derived: currentDerived });

  // Register new collisions
  for (const event of newCollisions) {
    store.registerCollision(event);
    store.setCooldown(event.pair, true);
  }
  // Sync cooldowns
  useStore.setState({ collisionCooldowns: Array.from(localCooldowns) });

  // Push trail points for all 3 bodies in one batched store update (one set() call
  // instead of three, avoiding 2 unnecessary Zustand notification cycles per frame).
  store.pushAllTrailPoints([
    { position: { ...currentBodies[0].position }, timestamp: currentTime },
    { position: { ...currentBodies[1].position }, timestamp: currentTime },
    { position: { ...currentBodies[2].position }, timestamp: currentTime },
  ]);

  // Push graph sample at 10Hz throttle
  if (timestamp - refs.lastGraphUpdate >= GRAPH_INTERVAL_MS) {
    store.pushGraphSample(currentTime, currentDerived);
    refs.lastGraphUpdate = timestamp;
  }

  // Pause on ejection
  if (ejected) {
    store.pause();
  }

  return { stepsExecuted: stepsToRun, physicsRan: true };
}

/**
 * Main simulation loop hook.
 * Owns requestAnimationFrame. Delegates per-frame physics to processSimulationFrame,
 * then triggers canvas rendering.
 *
 * When paused: skips physics but still renders (so filter toggles are responsive).
 * See ARCHITECTURE.md §6.
 */
export function useSimulationLoop(canvasRefs: CanvasLayerRefs | null, responsiveTier: ResponsiveTier): void {
  const rafIdRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const frameRefsRef = useRef<FrameRefs>({ accumulator: 0, lastGraphUpdate: 0, cachedInitialEnergy: null });
  const { update: updateViewport } = useViewport();
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const responsiveTierRef = useRef<ResponsiveTier>(responsiveTier);
  responsiveTierRef.current = responsiveTier;

  useEffect(() => {
    if (!canvasRefs) return;

    const refs = canvasRefs;

    function tick(timestamp: number) {
      const lastTs = lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      // Skip first frame (no delta yet)
      if (lastTs === 0) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // Wall-clock elapsed, capped at 100ms to prevent huge jumps after tab-away
      const wallElapsed = Math.min(timestamp - lastTs, 100);

      const { physicsRan } = processSimulationFrame(
        wallElapsed,
        timestamp,
        frameRefsRef.current,
      );

      // ─── Render every frame (even when paused) ───
      const store = useStore.getState();
      const { bodies, filters, derived, trailHistory, activeCollisions, activeBodyFocus } = store;

      const canvasWidth = refs.background.canvas.width;
      const canvasHeight = refs.background.canvas.height;

      if (canvasWidth > 0 && canvasHeight > 0) {
        const currentViewport = updateViewport(bodies, canvasWidth, canvasHeight);

        // Re-read trail history if physics ran (it was just updated)
        const latestTrailHistory = physicsRan
          ? useStore.getState().trailHistory
          : trailHistory;

        const renderState: RenderState = {
          bodies,
          trailHistory: latestTrailHistory,
          filters,
          derived,
          globals: store.globals,
          dpr: window.devicePixelRatio || 1,
          activeCollisions,
          activeBodyFocus,
          reducedMotion: reducedMotionRef.current,
          responsiveTier: responsiveTierRef.current,
        };

        renderFrame(refs, renderState, currentViewport, wallElapsed / 1000);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    }

    // Reset timing state and visual effects when the loop (re)starts.
    // cachedInitialEnergy is set to null so it's recomputed for the new run.
    lastTimestampRef.current = 0;
    frameRefsRef.current = { accumulator: 0, lastGraphUpdate: 0, cachedInitialEnergy: null };
    resetEffects();

    rafIdRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafIdRef.current);
  }, [canvasRefs, updateViewport]);
}
