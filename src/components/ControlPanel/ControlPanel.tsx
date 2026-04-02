import { useStore } from '../../state/store';
import { BodyControls } from './BodyControls';
import { GlobalControls } from './GlobalControls';
import { SeedControls } from './SeedControls';
import styles from './ControlPanel.module.css';

export function ControlPanel() {
  const mode = useStore((s) => s.mode);
  const isPlaying = useStore((s) => s.isPlaying);
  const commitStaged = useStore((s) => s.commitStaged);
  const setMode = useStore((s) => s.setMode);
  const randomReset = useStore((s) => s.randomReset);

  const isLabMode = mode === 'lab';
  // Disable random reset while a Lab Mode simulation is playing (controls are read-only)
  const randomResetDisabled = isLabMode && isPlaying;

  return (
    <div className={styles.panel}>
      <div className={styles.modeToggle}>
        <button
          type="button"
          className={`${styles.modeButton} ${isLabMode ? styles.modeButtonActive : ''}`}
          onClick={() => setMode('lab')}
        >
          Lab
        </button>
        <button
          type="button"
          className={`${styles.modeButton} ${!isLabMode ? styles.modeButtonActive : ''}`}
          onClick={() => setMode('live')}
        >
          Live
        </button>
      </div>

      <BodyControls bodyId="r" />
      <BodyControls bodyId="g" />
      <BodyControls bodyId="b" />
      <GlobalControls />
      <SeedControls />

      <div className={styles.runSection}>
        <button
          type="button"
          className={styles.randomResetButton}
          onClick={randomReset}
          disabled={randomResetDisabled}
          title={isLabMode ? 'Fill staged buffer with random values' : 'Apply random values instantly'}
        >
          Random Reset
        </button>

        {isLabMode && (
          isPlaying ? (
            <span className={styles.pauseHint}>Pause to edit</span>
          ) : (
            <button
              type="button"
              className={styles.runButton}
              onClick={commitStaged}
            >
              Run Simulation
            </button>
          )
        )}
      </div>
    </div>
  );
}
