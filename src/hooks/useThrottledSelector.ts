import { useEffect, useRef, useState } from 'react';
import { getState } from '../state/store';
import type { TrifectaStore } from '../state/store';

/**
 * Reads from the store at a fixed Hz rate instead of on every state change.
 * Useful for high-frequency data (physics state) that only needs to be
 * reflected in the UI at a lower cadence (e.g. the Data Panel table at 10Hz).
 */
export function useThrottledSelector<T>(
  selector: (state: TrifectaStore) => T,
  hz = 10,
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const [value, setValue] = useState<T>(() => selectorRef.current(getState()));

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(selectorRef.current(getState()));
    }, 1000 / hz);
    return () => clearInterval(interval);
  }, [hz]);

  return value;
}
