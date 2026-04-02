import { useStore } from '../../state/store';
import type { DataVariable } from '../../types/ui';
import styles from './DataPanel.module.css';

const VARIABLES: { id: DataVariable; label: string }[] = [
  { id: 'position',        label: 'Position'  },
  { id: 'speed',           label: 'Speed'     },
  { id: 'acceleration',    label: 'Accel'     },
  { id: 'kineticEnergy',   label: 'KE'        },
  { id: 'potentialEnergy', label: 'PE'        },
  { id: 'totalEnergy',     label: 'Total E'   },
  { id: 'angularMomentum', label: 'Ang Mom'   },
  { id: 'distances',       label: 'Dist'      },
  { id: 'centerOfMass',    label: 'CoM'       },
  { id: 'totalMomentum',   label: 'Momentum'  },
];

export function VariableFilter() {
  const visibleDataVariables = useStore((s) => s.visibleDataVariables);
  const toggleDataVariable   = useStore((s) => s.toggleDataVariable);

  return (
    <div className={styles.filterBar}>
      {VARIABLES.map(({ id, label }) => {
        const active = visibleDataVariables.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={() => toggleDataVariable(id)}
            title={id}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
