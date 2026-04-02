import { useState, useEffect } from 'react';
import styles from './NumberInput.module.css';

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  bodyColor?: string;
}

export function NumberInput({ value, min, max, step = 1, onChange, bodyColor }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const style = bodyColor ? ({ '--body-color': bodyColor } as React.CSSProperties) : undefined;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
  }

  function handleBlur() {
    const parsed = parseFloat(draft);
    if (isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setDraft(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleBlur();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setDraft(String(value));
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={styles.input}
      style={style}
      value={draft}
      step={step}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
