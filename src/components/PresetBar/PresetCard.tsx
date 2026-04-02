import React from 'react';
import type { Preset, PresetCategory } from '../../types/presets';
import { useStore } from '../../state/store';
import styles from './PresetBar.module.css';

// ─── Thumbnail SVGs ────────────────────────────────────────────────────────────

const THUMBNAIL_DEFS: Record<string, () => React.ReactElement> = {
  'figure-eight': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <path
        d="M60 40 C60 20, 90 20, 90 40 C90 60, 60 60, 60 40 C60 20, 30 20, 30 40 C30 60, 60 60, 60 40"
        fill="none" stroke="rgba(192,192,216,0.5)" strokeWidth="1.5"
      />
      <circle cx="30" cy="40" r="3" fill="#ff6b6b" />
      <circle cx="90" cy="40" r="3" fill="#6bff6b" />
      <circle cx="60" cy="40" r="3" fill="#6b9fff" />
    </svg>
  ),
  'lagrange-triangle': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <circle cx="60" cy="40" r="22" fill="none" stroke="rgba(192,192,216,0.2)" strokeWidth="1" />
      <polygon points="60,18 41,51 79,51" fill="none" stroke="rgba(192,192,216,0.4)" strokeWidth="1" />
      <circle cx="60" cy="18" r="3.5" fill="#ff6b6b" />
      <circle cx="41" cy="51" r="3.5" fill="#6bff6b" />
      <circle cx="79" cy="51" r="3.5" fill="#6b9fff" />
    </svg>
  ),
  'sun-earth-moon': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <circle cx="60" cy="40" r="30" fill="none" stroke="rgba(192,192,216,0.15)" strokeWidth="1" />
      <circle cx="90" cy="40" r="8" fill="none" stroke="rgba(192,192,216,0.2)" strokeWidth="1" />
      <circle cx="60" cy="40" r="10" fill="#ff6b6b" opacity="0.9" />
      <circle cx="90" cy="40" r="3.5" fill="#6bff6b" />
      <circle cx="98" cy="40" r="1.5" fill="#6b9fff" />
    </svg>
  ),
  'butterfly': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <path
        d="M60 40 C80 15, 100 30, 85 45 C70 60, 60 50, 60 40 C60 30, 50 20, 35 35 C20 50, 40 65, 60 40"
        fill="none" stroke="rgba(192,192,216,0.5)" strokeWidth="1.5"
      />
      <circle cx="35" cy="35" r="3" fill="#ff6b6b" />
      <circle cx="85" cy="45" r="3" fill="#6bff6b" />
      <circle cx="60" cy="40" r="3" fill="#6b9fff" />
    </svg>
  ),
  'chaotic-scatter': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <line x1="30" y1="55" x2="75" y2="25" stroke="rgba(255,107,107,0.4)" strokeWidth="1" />
      <line x1="90" y1="55" x2="55" y2="20" stroke="rgba(107,255,107,0.4)" strokeWidth="1" />
      <line x1="60" y1="65" x2="60" y2="18" stroke="rgba(107,159,255,0.4)" strokeWidth="1" />
      <circle cx="30" cy="55" r="3.5" fill="#ff6b6b" />
      <circle cx="90" cy="55" r="3.5" fill="#6bff6b" />
      <circle cx="60" cy="18" r="3.5" fill="#6b9fff" />
    </svg>
  ),
  'binary-orbiter': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <circle cx="60" cy="40" r="28" fill="none" stroke="rgba(192,192,216,0.15)" strokeWidth="1" />
      <circle cx="54" cy="40" r="8" fill="none" stroke="rgba(192,192,216,0.3)" strokeWidth="1" />
      <circle cx="50" cy="40" r="3.5" fill="#ff6b6b" />
      <circle cx="58" cy="40" r="3.5" fill="#6bff6b" />
      <circle cx="88" cy="40" r="2.5" fill="#6b9fff" />
    </svg>
  ),
  'head-on-approach': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <line x1="25" y1="55" x2="58" y2="42" stroke="rgba(255,107,107,0.5)" strokeWidth="1.5" strokeDasharray="3,2" />
      <line x1="95" y1="55" x2="64" y2="42" stroke="rgba(107,255,107,0.5)" strokeWidth="1.5" strokeDasharray="3,2" />
      <line x1="60" y1="15" x2="60" y2="38" stroke="rgba(107,159,255,0.5)" strokeWidth="1.5" strokeDasharray="3,2" />
      <circle cx="25" cy="58" r="4" fill="#ff6b6b" />
      <circle cx="95" cy="58" r="3.5" fill="#6bff6b" />
      <circle cx="60" cy="12" r="3.8" fill="#6b9fff" />
    </svg>
  ),
  'broucke-hadjidemetriou': () => (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <ellipse cx="60" cy="40" rx="45" ry="15" fill="none" stroke="rgba(192,192,216,0.25)" strokeWidth="1" />
      <ellipse cx="60" cy="40" rx="20" ry="25" fill="none" stroke="rgba(192,192,216,0.2)" strokeWidth="1" />
      <circle cx="22" cy="40" r="3.5" fill="#ff6b6b" />
      <circle cx="80" cy="40" r="3.5" fill="#6bff6b" />
      <circle cx="40" cy="40" r="3.5" fill="#6b9fff" />
    </svg>
  ),
};

function PresetThumbnail({ id }: { id: string }) {
  const Thumb = THUMBNAIL_DEFS[id];
  if (Thumb) return <Thumb />;
  // Generic fallback: three colored dots
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%">
      <circle cx="40" cy="40" r="5" fill="#ff6b6b" />
      <circle cx="60" cy="30" r="5" fill="#6bff6b" />
      <circle cx="80" cy="40" r="5" fill="#6b9fff" />
    </svg>
  );
}

// ─── Category badge style map ──────────────────────────────────────────────────

const BADGE_CLASS: Record<PresetCategory, string> = {
  stable:        styles.badge_stable,
  choreographic: styles.badge_choreographic,
  hierarchical:  styles.badge_hierarchical,
  chaotic:       styles.badge_chaotic,
  collision:     styles.badge_collision,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface PresetCardProps {
  preset: Preset;
}

export function PresetCard({ preset }: PresetCardProps) {
  const activePresetId = useStore((s) => s.activePresetId);
  const loadPreset = useStore((s) => s.loadPreset);

  const isActive = activePresetId === preset.id;

  return (
    <div
      className={`${styles.card}${isActive ? ` ${styles.active}` : ''}`}
      onClick={() => loadPreset(preset)}
      title={preset.description}
      role="button"
      aria-pressed={isActive}
    >
      <div className={styles.thumbnail}>
        <PresetThumbnail id={preset.id} />
      </div>
      <div className={styles.name}>{preset.name}</div>
      <span className={`${styles.categoryBadge} ${BADGE_CLASS[preset.category]}`}>
        {preset.category}
      </span>
    </div>
  );
}
