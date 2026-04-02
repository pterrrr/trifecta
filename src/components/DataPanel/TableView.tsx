import { useThrottledSelector } from '../../hooks/useThrottledSelector';
import { useActiveBodyFocus } from '../../hooks/useActiveBodyFocus';
import { formatNumber } from '../../utils/formatting';
import type { TrifectaStore } from '../../state/store';
import type { DataVariable } from '../../types/ui';
import styles from './DataPanel.module.css';

// Body UI colors at 5 % opacity for the focused-column tint
const BODY_TINTS = {
  r: 'rgba(204, 68, 68, 0.08)',
  g: 'rgba(68, 204, 102, 0.08)',
  b: 'rgba(68, 102, 204, 0.08)',
} as const;

// UI accent colors for column headers
const BODY_HEADER_COLORS = {
  r: 'var(--color-body-r-ui)',
  g: 'var(--color-body-g-ui)',
  b: 'var(--color-body-b-ui)',
} as const;

// ─── Stable selector (defined outside the component) ───

function tableSelector(s: TrifectaStore) {
  return {
    bodies:               s.bodies,
    derived:              s.derived,
    visibleDataVariables: s.visibleDataVariables,
  };
}

// ─── Row builder ───

interface TableRow {
  id: DataVariable;
  label: string;
  r: string;
  g: string;
  b: string;
  system: string;
}

function buildRows(
  bodies:               TrifectaStore['bodies'],
  derived:              TrifectaStore['derived'],
  visibleDataVariables: TrifectaStore['visibleDataVariables'],
): TableRow[] {
  const rows: TableRow[] = [];
  const vis = visibleDataVariables;

  if (vis.includes('position')) {
    rows.push({
      id: 'position', label: 'Position',
      r: `${formatNumber(bodies[0].position.x)}, ${formatNumber(bodies[0].position.y)}`,
      g: `${formatNumber(bodies[1].position.x)}, ${formatNumber(bodies[1].position.y)}`,
      b: `${formatNumber(bodies[2].position.x)}, ${formatNumber(bodies[2].position.y)}`,
      system: '',
    });
  }

  if (vis.includes('speed')) {
    rows.push({
      id: 'speed', label: 'Speed',
      r: formatNumber(derived.bodyDerived[0].speed),
      g: formatNumber(derived.bodyDerived[1].speed),
      b: formatNumber(derived.bodyDerived[2].speed),
      system: '',
    });
  }

  if (vis.includes('acceleration')) {
    const fmt = (n: number) => formatNumber(n);
    rows.push({
      id: 'acceleration', label: 'Accel',
      r: `${fmt(derived.bodyDerived[0].acceleration.x)}, ${fmt(derived.bodyDerived[0].acceleration.y)}`,
      g: `${fmt(derived.bodyDerived[1].acceleration.x)}, ${fmt(derived.bodyDerived[1].acceleration.y)}`,
      b: `${fmt(derived.bodyDerived[2].acceleration.x)}, ${fmt(derived.bodyDerived[2].acceleration.y)}`,
      system: '',
    });
  }

  if (vis.includes('kineticEnergy')) {
    rows.push({
      id: 'kineticEnergy', label: 'Kinetic E',
      r: formatNumber(derived.bodyDerived[0].kineticEnergy),
      g: formatNumber(derived.bodyDerived[1].kineticEnergy),
      b: formatNumber(derived.bodyDerived[2].kineticEnergy),
      system: '',
    });
  }

  if (vis.includes('potentialEnergy')) {
    const pe = derived.potentialEnergies;
    rows.push({
      id: 'potentialEnergy', label: 'Potential E',
      r: '', g: '', b: '',
      system: `RG ${formatNumber(pe.rg)}  RB ${formatNumber(pe.rb)}  GB ${formatNumber(pe.gb)}`,
    });
  }

  if (vis.includes('totalEnergy')) {
    rows.push({
      id: 'totalEnergy', label: 'Total E',
      r: '', g: '', b: '',
      system: formatNumber(derived.totalEnergy),
    });
  }

  if (vis.includes('angularMomentum')) {
    rows.push({
      id: 'angularMomentum', label: 'Ang Mom',
      r: '', g: '', b: '',
      system: formatNumber(derived.angularMomentum),
    });
  }

  if (vis.includes('distances')) {
    const d = derived.distances;
    rows.push({
      id: 'distances', label: 'Distances',
      r: '', g: '', b: '',
      system: `RG ${formatNumber(d.rg)}  RB ${formatNumber(d.rb)}  GB ${formatNumber(d.gb)}`,
    });
  }

  if (vis.includes('centerOfMass')) {
    const c = derived.centerOfMass;
    rows.push({
      id: 'centerOfMass', label: 'Center of Mass',
      r: '', g: '', b: '',
      system: `${formatNumber(c.x)}, ${formatNumber(c.y)}`,
    });
  }

  if (vis.includes('totalMomentum')) {
    const p = derived.totalMomentum;
    rows.push({
      id: 'totalMomentum', label: 'Momentum',
      r: '', g: '', b: '',
      system: `${formatNumber(p.x)}, ${formatNumber(p.y)}`,
    });
  }

  return rows;
}

// ─── Component ───

export function TableView() {
  const { activeBodyFocus } = useActiveBodyFocus();
  const { bodies, derived, visibleDataVariables } = useThrottledSelector(tableSelector, 10);
  const rows = buildRows(bodies, derived, visibleDataVariables);

  if (rows.length === 0) {
    return <p className={styles.emptyMessage}>No variables selected</p>;
  }

  // Column tint: body column gets a tint when that body is focused
  function colBg(bodyId: 'r' | 'g' | 'b'): string | undefined {
    if (activeBodyFocus === bodyId) return BODY_TINTS[bodyId];
    return undefined;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thLabel}>Variable</th>
            <th
              className={styles.thBody}
              style={{ color: BODY_HEADER_COLORS.r, backgroundColor: colBg('r') }}
            >
              R
            </th>
            <th
              className={styles.thBody}
              style={{ color: BODY_HEADER_COLORS.g, backgroundColor: colBg('g') }}
            >
              G
            </th>
            <th
              className={styles.thBody}
              style={{ color: BODY_HEADER_COLORS.b, backgroundColor: colBg('b') }}
            >
              B
            </th>
            <th className={styles.thSystem}>System</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={styles.tableRow}>
              <td className={styles.tdLabel}>{row.label}</td>
              <td className={styles.tdValue} style={{ backgroundColor: colBg('r') }}>
                {row.r}
              </td>
              <td className={styles.tdValue} style={{ backgroundColor: colBg('g') }}>
                {row.g}
              </td>
              <td className={styles.tdValue} style={{ backgroundColor: colBg('b') }}>
                {row.b}
              </td>
              <td className={styles.tdSystem}>{row.system}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
