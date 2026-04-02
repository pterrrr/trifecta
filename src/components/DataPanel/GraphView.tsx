import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useThrottledSelector } from '../../hooks/useThrottledSelector';
import { useActiveBodyFocus } from '../../hooks/useActiveBodyFocus';
import type { TrifectaStore } from '../../state/store';
import type { GraphSample } from '../../state/slices/historySlice';
import type { DataVariable } from '../../types/ui';
import styles from './DataPanel.module.css';

const ROLLING_WINDOW = 500;

// ─── Group definitions ───

interface GraphLine {
  key: keyof GraphSample;
  label: string;
  color: string;
  bodyId?: 'r' | 'g' | 'b';
}

interface GraphGroup {
  id: string;
  label: string;
  triggerVariables: DataVariable[];
  lines: GraphLine[];
}

const GRAPH_GROUPS: GraphGroup[] = [
  {
    id: 'speeds',
    label: 'Speed',
    triggerVariables: ['speed'],
    lines: [
      { key: 'speedR', label: 'R', bodyId: 'r', color: '#cc4444' },
      { key: 'speedG', label: 'G', bodyId: 'g', color: '#44cc66' },
      { key: 'speedB', label: 'B', bodyId: 'b', color: '#4466cc' },
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    triggerVariables: ['kineticEnergy', 'potentialEnergy', 'totalEnergy'],
    lines: [
      { key: 'keR',          label: 'KE R',  bodyId: 'r', color: '#cc4444' },
      { key: 'keG',          label: 'KE G',  bodyId: 'g', color: '#44cc66' },
      { key: 'keB',          label: 'KE B',  bodyId: 'b', color: '#4466cc' },
      { key: 'peRG',         label: 'PE RG',              color: '#cc8844' },
      { key: 'peRB',         label: 'PE RB',              color: '#cc44cc' },
      { key: 'peGB',         label: 'PE GB',              color: '#44cccc' },
      { key: 'totalEnergy',  label: 'Total E',            color: '#c0c0d8' },
    ],
  },
  {
    id: 'distances',
    label: 'Distances',
    triggerVariables: ['distances'],
    lines: [
      { key: 'distRG', label: 'R–G', color: '#cc8844' },
      { key: 'distRB', label: 'R–B', color: '#cc44cc' },
      { key: 'distGB', label: 'G–B', color: '#44cccc' },
    ],
  },
  {
    id: 'angularMomentum',
    label: 'Angular Momentum',
    triggerVariables: ['angularMomentum'],
    lines: [
      { key: 'angularMomentum', label: 'L', color: '#a0a0b8' },
    ],
  },
];

// ─── Stable selector ───

function graphSelector(s: TrifectaStore) {
  return {
    // slice() creates a new array every call — ensures setValue triggers re-render
    // even though graphHistory is mutated in-place in the store
    chartData:            s.graphHistory.slice(-ROLLING_WINDOW),
    visibleDataVariables: s.visibleDataVariables,
  };
}

// ─── Tick formatters ───

function xTick(value: number): string {
  return value.toFixed(1);
}

function yTick(value: number): string {
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
    return value.toExponential(1);
  }
  return value.toFixed(2);
}

// ─── Component ───

export function GraphView() {
  const { activeBodyFocus } = useActiveBodyFocus();
  const { chartData, visibleDataVariables } = useThrottledSelector(graphSelector, 10);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  const activeGroups = GRAPH_GROUPS.filter((g) =>
    g.triggerVariables.some((v) => visibleDataVariables.includes(v)),
  );

  if (activeGroups.length === 0) {
    return <p className={styles.emptyMessage}>No variables selected</p>;
  }

  if (chartData.length === 0) {
    return (
      <p className={styles.emptyMessage}>No data yet — run the simulation</p>
    );
  }

  return (
    <div className={styles.graphContainer}>
      {activeGroups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.id);

        return (
          <div key={group.id} className={styles.chartGroup}>
            <button
              type="button"
              className={styles.chartGroupHeader}
              onClick={() => toggleGroup(group.id)}
            >
              <span>{group.label}</span>
              <span className={styles.chartGroupChevron}>
                {isCollapsed ? '▶' : '▼'}
              </span>
            </button>

            {!isCollapsed && (
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="time"
                      tickFormatter={xTick}
                      tick={{ fontSize: 9, fill: '#6a6a82' }}
                      tickLine={false}
                      axisLine={{ stroke: '#2a2a40' }}
                    />
                    <YAxis
                      tickFormatter={yTick}
                      tick={{ fontSize: 9, fill: '#6a6a82' }}
                      tickLine={false}
                      axisLine={{ stroke: '#2a2a40' }}
                      width={46}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#22223a',
                        border: '1px solid #2a2a40',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#e8e8f0',
                      }}
                      formatter={(value) =>
                        typeof value === 'number' ? value.toFixed(3) : String(value ?? '')
                      }
                      labelFormatter={(label: unknown) =>
                        `t = ${typeof label === 'number' ? label.toFixed(2) : label}`
                      }
                    />
                    {group.lines.map((line) => {
                      const isFocused =
                        activeBodyFocus !== null &&
                        line.bodyId === activeBodyFocus;
                      const isDimmed =
                        activeBodyFocus !== null &&
                        line.bodyId !== undefined &&
                        line.bodyId !== activeBodyFocus;

                      return (
                        <Line
                          key={String(line.key)}
                          type="monotone"
                          dataKey={line.key as string}
                          stroke={line.color}
                          strokeWidth={isFocused ? 3 : 2}
                          strokeOpacity={isDimmed ? 0.5 : 1}
                          dot={false}
                          isAnimationActive={false}
                          name={line.label}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
