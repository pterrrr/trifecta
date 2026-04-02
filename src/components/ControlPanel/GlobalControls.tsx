import { useCallback } from 'react';
import { useStore } from '../../state/store';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { Slider } from './Slider';
import { NumberInput } from './NumberInput';
import { GLOBAL_VARIABLE_RANGES } from '../../constants';

import styles from './ControlPanel.module.css';

export function GlobalControls() {
  const mode = useStore((s) => s.mode);
  const isPlaying = useStore((s) => s.isPlaying);
  const isLabMode = mode === 'lab';
  const disabled = isLabMode && isPlaying;

  const globals = useStore((s) => {
    if (isLabMode) {
      return s.stagedGlobals ?? s.globals;
    }
    return s.globals;
  });

  const setGlobalProp = useStore((s) =>
    isLabMode ? s.setStagedGlobal : s.setGlobal,
  );

  const setG = useCallback(
    (v: number) => setGlobalProp('G', v),
    [setGlobalProp],
  );
  const setSoftening = useCallback(
    (v: number) => setGlobalProp('softening', v),
    [setGlobalProp],
  );
  const setTrailLength = useCallback(
    (v: number) => setGlobalProp('trailLength', Math.round(v)),
    [setGlobalProp],
  );

  const ranges = GLOBAL_VARIABLE_RANGES;

  return (
    <CollapsibleSection title="Global" defaultOpen={false}>
      <div className={styles.controlGroup}>
        <div className={`${styles.controlRow} ${disabled ? styles.controlRowDisabled : ''}`}>
          <label className={styles.controlLabel}>G</label>
          <div className={styles.controlInputs}>
            {isLabMode && (
              <NumberInput
                value={globals.G}
                min={ranges.G.min}
                max={ranges.G.max}
                step={0.01}
                onChange={setG}
              />
            )}
            <Slider
              value={globals.G}
              min={ranges.G.min}
              max={ranges.G.max}
              step={0.01}
              onChange={setG}
              logarithmic
            />
          </div>
        </div>
        <div className={`${styles.controlRow} ${disabled ? styles.controlRowDisabled : ''}`}>
          <label className={styles.controlLabel}>Softening</label>
          <div className={styles.controlInputs}>
            {isLabMode && (
              <NumberInput
                value={globals.softening}
                min={ranges.softening.min}
                max={ranges.softening.max}
                step={0.001}
                onChange={setSoftening}
              />
            )}
            <Slider
              value={globals.softening}
              min={ranges.softening.min}
              max={ranges.softening.max}
              step={0.001}
              onChange={setSoftening}
              logarithmic
            />
          </div>
        </div>
        <div className={`${styles.controlRow} ${disabled ? styles.controlRowDisabled : ''}`}>
          <label className={styles.controlLabel}>Trail Len</label>
          <div className={styles.controlInputs}>
            {isLabMode && (
              <NumberInput
                value={globals.trailLength}
                min={ranges.trailLength.min}
                max={ranges.trailLength.max}
                step={50}
                onChange={setTrailLength}
              />
            )}
            <Slider
              value={globals.trailLength}
              min={ranges.trailLength.min}
              max={ranges.trailLength.max}
              step={50}
              onChange={setTrailLength}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
