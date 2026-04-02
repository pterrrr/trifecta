import { useState } from 'react';
import { useStore } from '../../state/store';
import { VariableFilter } from './VariableFilter';
import { TableView } from './TableView';
import { GraphView } from './GraphView';
import styles from './DataPanel.module.css';

type ActiveTab = 'table' | 'graph';

export function DataPanel() {
  const isOpen      = useStore((s) => s.panelVisibility.dataPanel);
  const togglePanel = useStore((s) => s.togglePanel);
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');

  if (!isOpen) {
    return (
      <div className={`${styles.panel} ${styles.panelCollapsed}`}>
        <button
          type="button"
          className={styles.collapsedToggle}
          onClick={() => togglePanel('dataPanel')}
          title="Open Data Panel"
        >
          Data Panel
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.title}>Data Panel</span>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => togglePanel('dataPanel')}
          title="Close Data Panel"
        >
          ✕
        </button>
      </div>

      {/* ── Variable filter chips ── */}
      <VariableFilter />

      {/* ── Table / Graph tabs ── */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'table' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('table')}
        >
          Table
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'graph' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          Graph
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className={styles.content}>
        {activeTab === 'table' ? <TableView /> : <GraphView />}
      </div>
    </div>
  );
}
