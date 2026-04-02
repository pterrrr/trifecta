import { useRef, useLayoutEffect, useState } from 'react';
import { useStore } from '../../state/store';
import type { InteractionMode } from '../../types';
import styles from './ModeToggle.module.css';

const MODES: { value: InteractionMode; label: string }[] = [
  { value: 'lab', label: 'Lab' },
  { value: 'live', label: 'Live' },
];

export function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  const labRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeEl = mode === 'lab' ? labRef.current : liveRef.current;
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [mode]);

  return (
    <div ref={containerRef} className={styles.toggle} role="group" aria-label="Interaction mode">
      <div className={styles.indicator} style={indicatorStyle} aria-hidden="true" />
      {MODES.map(({ value, label }) => (
        <span
          key={value}
          ref={value === 'lab' ? labRef : liveRef}
          className={`${styles.label} ${mode === value ? styles.active : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setMode(value);
            }
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
