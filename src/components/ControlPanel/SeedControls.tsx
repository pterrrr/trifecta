import { useState, useCallback, useRef } from 'react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { useSelectCurrentSeed } from '../../state/selectors';
import { useStore } from '../../state/store';
import { decodeSeed } from '../../seed';
import { copyToClipboard } from '../../utils/clipboard';
import styles from './SeedControls.module.css';

export function SeedControls() {
  const currentSeed = useSelectCurrentSeed();
  const loadSeed = useStore((s) => s.loadSeed);

  const [copiedVisible, setCopiedVisible] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [error, setError] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(currentSeed);
    if (ok) {
      setCopiedVisible(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedVisible(false), 1500);
    }
  }, [currentSeed]);

  const tryLoadSeed = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const decoded = decodeSeed(trimmed);
    if (decoded) {
      loadSeed(decoded);
      setPasteValue('');
      setError(false);
    } else {
      setError(true);
    }
  }, [loadSeed]);

  const handlePasteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') tryLoadSeed(pasteValue);
    },
    [pasteValue, tryLoadSeed],
  );

  const handlePasteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasteValue(e.target.value);
      if (error) setError(false);
    },
    [error],
  );

  return (
    <CollapsibleSection title="Seed" defaultOpen={true}>
      <div className={styles.seedSection}>
        <div className={styles.seedHeader}>
          <span className={styles.seedDisplay} title={currentSeed}>
            {currentSeed}
          </span>
          <button type="button" className={styles.copyButton} onClick={handleCopy}>
            Copy
          </button>
        </div>

        <div className={`${styles.copyConfirmation} ${copiedVisible ? styles.visible : ''}`}>
          Copied!
        </div>

        <div className={styles.pasteRow}>
          <input
            type="text"
            className={`${styles.pasteInput} ${error ? styles.error : ''}`}
            placeholder="Paste seed…"
            value={pasteValue}
            onChange={handlePasteChange}
            onKeyDown={handlePasteKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.pasteButton}
            onClick={() => tryLoadSeed(pasteValue)}
          >
            Load
          </button>
        </div>

        {error && <div className={styles.errorMessage}>Invalid seed</div>}
      </div>
    </CollapsibleSection>
  );
}
