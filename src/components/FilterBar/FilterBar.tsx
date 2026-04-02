import { useStore } from '../../state/store';
import type { VisualFilters } from '../../types';
import styles from './FilterBar.module.css';

const FILTERS: { key: keyof VisualFilters; label: string }[] = [
  { key: 'trails',              label: 'Trails' },
  { key: 'velocityVectors',     label: 'Velocity' },
  { key: 'accelerationVectors', label: 'Acceleration' },
  { key: 'distanceLines',       label: 'Distances' },
  { key: 'centerOfMass',        label: 'Center of Mass' },
  { key: 'gravitationalField',  label: 'Gravity Field' },
  { key: 'backgroundAnimation', label: 'Background' },
];

interface FilterBarProps {
  excludeGravField?: boolean;
}

export function FilterBar({ excludeGravField = false }: FilterBarProps) {
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);

  const visibleFilters = excludeGravField
    ? FILTERS.filter((f) => f.key !== 'gravitationalField')
    : FILTERS;

  return (
    <div className={styles.filterBar}>
      {visibleFilters.map(({ key, label }) => (
        <button
          key={key}
          className={`${styles.chip} ${filters[key] ? styles.active : ''}`}
          onClick={() => setFilter(key, !filters[key])}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
