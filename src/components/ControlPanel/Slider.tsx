import styles from './Slider.module.css';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  bodyColor?: string;
  logarithmic?: boolean;
}

function toLog(value: number, min: number, max: number): number {
  const logMin = Math.log(Math.max(min, 1e-10));
  const logMax = Math.log(Math.max(max, 1e-10));
  return (Math.log(Math.max(value, 1e-10)) - logMin) / (logMax - logMin);
}

function fromLog(t: number, min: number, max: number): number {
  const logMin = Math.log(Math.max(min, 1e-10));
  const logMax = Math.log(Math.max(max, 1e-10));
  return Math.exp(logMin + t * (logMax - logMin));
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  bodyColor,
  logarithmic = false,
}: SliderProps) {
  const style = bodyColor ? ({ '--body-color': bodyColor } as React.CSSProperties) : undefined;

  const internalMin = logarithmic ? 0 : min;
  const internalMax = logarithmic ? 1 : max;
  const internalStep = logarithmic ? 0.001 : step;
  const internalValue = logarithmic ? toLog(value, min, max) : value;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseFloat(e.target.value);
    const resolved = logarithmic ? fromLog(raw, min, max) : raw;
    onChange(resolved);
  }

  return (
    <input
      type="range"
      className={styles.slider}
      style={style}
      min={internalMin}
      max={internalMax}
      step={internalStep}
      value={internalValue}
      onChange={handleChange}
    />
  );
}
