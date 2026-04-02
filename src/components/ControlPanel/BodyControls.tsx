import { useCallback } from 'react';
import { useStore } from '../../state/store';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { Slider } from './Slider';
import { NumberInput } from './NumberInput';
import { BODY_VARIABLE_RANGES } from '../../constants';
import type { BodyId } from '../../types';
import styles from './ControlPanel.module.css';

interface BodyControlsProps {
  bodyId: BodyId;
}

const BODY_LABELS: Record<BodyId, string> = {
  r: 'Body R',
  g: 'Body G',
  b: 'Body B',
};

const BODY_COLORS: Record<BodyId, string> = {
  r: 'var(--color-body-r)',
  g: 'var(--color-body-g)',
  b: 'var(--color-body-b)',
};

const BODY_INDEX: Record<BodyId, 0 | 1 | 2> = { r: 0, g: 1, b: 2 };

interface ControlRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  bodyColor: string;
  showInput: boolean;
  logarithmic?: boolean;
  disabled?: boolean;
}

function ControlRow({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  bodyColor,
  showInput,
  logarithmic,
  disabled,
}: ControlRowProps) {
  return (
    <div className={`${styles.controlRow} ${disabled ? styles.controlRowDisabled : ''}`}>
      <label className={styles.controlLabel}>{label}</label>
      <div className={styles.controlInputs}>
        {showInput && (
          <NumberInput
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
            bodyColor={bodyColor}
          />
        )}
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          bodyColor={bodyColor}
          logarithmic={logarithmic}
        />
      </div>
    </div>
  );
}

export function BodyControls({ bodyId }: BodyControlsProps) {
  const mode = useStore((s) => s.mode);
  const isPlaying = useStore((s) => s.isPlaying);
  const activeBodyFocus = useStore((s) => s.activeBodyFocus);
  const setActiveBodyFocus = useStore((s) => s.setActiveBodyFocus);

  const idx = BODY_INDEX[bodyId];
  const bodyColor = BODY_COLORS[bodyId];
  const isLabMode = mode === 'lab';
  const disabled = isLabMode && isPlaying;

  // Read from staged (lab) or active (live) state
  const body = useStore((s) => {
    if (isLabMode) {
      return s.stagedBodies ? s.stagedBodies[idx] : s.bodies[idx];
    }
    return s.bodies[idx];
  });

  // Write to staged (lab) or active (live) state
  const setBodyProp = useStore((s) =>
    isLabMode ? s.setStagedBodyProperty : s.setBodyProperty,
  );

  const setMass = useCallback(
    (v: number) => setBodyProp(bodyId, 'mass', v),
    [setBodyProp, bodyId],
  );
  const setPosX = useCallback(
    (v: number) => setBodyProp(bodyId, 'position', { x: v, y: body.position.y }),
    [setBodyProp, bodyId, body.position.y],
  );
  const setPosY = useCallback(
    (v: number) => setBodyProp(bodyId, 'position', { x: body.position.x, y: v }),
    [setBodyProp, bodyId, body.position.x],
  );
  const setVelX = useCallback(
    (v: number) => setBodyProp(bodyId, 'velocity', { x: v, y: body.velocity.y }),
    [setBodyProp, bodyId, body.velocity.y],
  );
  const setVelY = useCallback(
    (v: number) => setBodyProp(bodyId, 'velocity', { x: body.velocity.x, y: v }),
    [setBodyProp, bodyId, body.velocity.x],
  );

  const isFocused = activeBodyFocus === bodyId;
  const isDimmed = activeBodyFocus !== null && activeBodyFocus !== bodyId;

  const handleFocus = useCallback(() => setActiveBodyFocus(bodyId), [setActiveBodyFocus, bodyId]);
  const handleBlur = useCallback(() => setActiveBodyFocus(null), [setActiveBodyFocus]);

  const ranges = BODY_VARIABLE_RANGES;

  return (
    <div
      className={`${styles.bodySection} ${isFocused ? styles.bodySectionFocused : ''} ${isDimmed ? styles.bodySectionDimmed : ''}`}
      style={
        {
          '--section-body-color': bodyColor,
        } as React.CSSProperties
      }
      onMouseEnter={handleFocus}
      onMouseLeave={handleBlur}
      onFocusCapture={handleFocus}
    >
      <CollapsibleSection title={BODY_LABELS[bodyId]} bodyColor={bodyColor}>
        <div className={styles.controlGroup}>
          <ControlRow
            label="Mass"
            value={body.mass}
            min={ranges.mass.min}
            max={ranges.mass.max}
            step={0.01}
            onChange={setMass}
            bodyColor={bodyColor}
            showInput={isLabMode}
            logarithmic
            disabled={disabled}
          />
          <ControlRow
            label="Pos X"
            value={body.position.x}
            min={ranges.positionX.min}
            max={ranges.positionX.max}
            step={0.1}
            onChange={setPosX}
            bodyColor={bodyColor}
            showInput={isLabMode}
            disabled={disabled}
          />
          <ControlRow
            label="Pos Y"
            value={body.position.y}
            min={ranges.positionY.min}
            max={ranges.positionY.max}
            step={0.1}
            onChange={setPosY}
            bodyColor={bodyColor}
            showInput={isLabMode}
            disabled={disabled}
          />
          <ControlRow
            label="Vel X"
            value={body.velocity.x}
            min={ranges.velocityX.min}
            max={ranges.velocityX.max}
            step={0.1}
            onChange={setVelX}
            bodyColor={bodyColor}
            showInput={isLabMode}
            disabled={disabled}
          />
          <ControlRow
            label="Vel Y"
            value={body.velocity.y}
            min={ranges.velocityY.min}
            max={ranges.velocityY.max}
            step={0.1}
            onChange={setVelY}
            bodyColor={bodyColor}
            showInput={isLabMode}
            disabled={disabled}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
