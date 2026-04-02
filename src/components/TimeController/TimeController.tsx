import { useStore } from '../../state/store';
import { IconButton } from '../shared/IconButton';
import { BASE_DT } from '../../constants/physics';
import styles from './TimeController.module.css';

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <polygon points="2,1 11,6 2,11" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="2" y="1" width="3" height="10" rx="1" />
      <rect x="7" y="1" width="3" height="10" rx="1" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6a4 4 0 1 0 1-2.6" />
      <polyline points="2,2 2,6 6,6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <polygon points="1,1 8,6 1,11" />
      <rect x="9" y="1" width="2" height="10" rx="0.5" />
    </svg>
  );
}

export function TimeController() {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const time = useStore((s) => s.time);
  const togglePlayPause = useStore((s) => s.togglePlayPause);
  const reset = useStore((s) => s.reset);
  const setSpeed = useStore((s) => s.setSpeed);
  const stepForward = useStore((s) => s.stepForward);

  return (
    <div className={styles.controller}>
      <IconButton
        icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
        onClick={togglePlayPause}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      />
      <IconButton
        icon={<ResetIcon />}
        onClick={reset}
        title="Reset (R)"
      />
      <IconButton
        icon={<StepIcon />}
        onClick={() => stepForward(BASE_DT)}
        disabled={isPlaying}
        title="Step Forward"
      />

      <div className={styles.separator} />

      <div className={styles.speedControl}>
        <input
          type="range"
          className={styles.speedSlider}
          min={0.1}
          max={10}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title="Simulation speed"
          aria-label="Simulation speed"
        />
        <span className={styles.speedLabel}>{speed.toFixed(1)}×</span>
      </div>

      <div className={styles.separator} />

      <span className={styles.timeDisplay}>t={time.toFixed(3)}</span>
    </div>
  );
}
