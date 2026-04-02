import { PRESETS } from '../../presets/presetData';
import { PresetCard } from './PresetCard';
import styles from './PresetBar.module.css';

export function PresetBar() {
  return (
    <div className={styles.bar}>
      {PRESETS.map((preset) => (
        <PresetCard key={preset.id} preset={preset} />
      ))}
    </div>
  );
}
