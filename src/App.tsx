import { useState } from 'react';
import styles from './App.module.css';
import { CanvasStack } from './renderer/CanvasStack';
import { useSimulationLoop } from './hooks/useSimulationLoop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUrlSeed } from './hooks/useUrlSeed';
import { useResponsiveTier } from './hooks/useResponsiveTier';
import { useStore } from './state/store';
import type { CanvasLayerRefs } from './renderer/renderLoop';
import { FilterBar } from './components/FilterBar/FilterBar';
import { ControlPanel } from './components/ControlPanel/ControlPanel';
import { ModeToggle } from './components/ModeToggle/ModeToggle';
import { TimeController } from './components/TimeController/TimeController';
import { PresetBar } from './components/PresetBar/PresetBar';
import { DataPanel } from './components/DataPanel/DataPanel';

type MobileTab = 'control' | 'data' | 'presets' | null;

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3" width="14" height="2" rx="1" />
      <rect x="2" y="8" width="14" height="2" rx="1" />
      <rect x="2" y="13" width="14" height="2" rx="1" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="12" height="2" rx="1" />
      <rect x="2" y="7" width="8" height="2" rx="1" />
      <rect x="2" y="12" width="10" height="2" rx="1" />
    </svg>
  );
}

function App() {
  const [canvasRefs, setCanvasRefs] = useState<CanvasLayerRefs | null>(null);
  const tier = useResponsiveTier();

  // Desktop: data panel open/collapsed (existing store state)
  const dataPanelOpen = useStore((s) => s.panelVisibility.dataPanel);

  // Tablet: drawer open state
  const [controlOpen, setControlOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  // Mobile: active bottom tab and filter bar visibility
  const [activeTab, setActiveTab] = useState<MobileTab>(null);
  const [filterBarOpen, setFilterBarOpen] = useState(false);

  useSimulationLoop(canvasRefs, tier);
  useKeyboardShortcuts();
  useUrlSeed();

  const closeAllDrawers = () => {
    setControlOpen(false);
    setDataOpen(false);
  };

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (tier === 'mobile') {
    return (
      <div className={styles.mobileShell}>
        <header className={styles.header}>
          <span className={styles.title}>Trifecta</span>
          <ModeToggle />
        </header>

        <div className={styles.mobileFilterBar}>
          <button
            className={styles.filterBarToggle}
            onClick={() => setFilterBarOpen((o) => !o)}
            aria-expanded={filterBarOpen}
          >
            Filters {filterBarOpen ? '▲' : '▼'}
          </button>
          {filterBarOpen && <FilterBar excludeGravField />}
        </div>

        <main className={styles.mobileCanvas}>
          <CanvasStack onRefsReady={setCanvasRefs} />
          <div className={styles.floatingTimeController}>
            <TimeController />
          </div>
        </main>

        {activeTab !== null && (
          <div
            className={styles.bottomSheetOverlay}
            onClick={() => setActiveTab(null)}
          />
        )}

        {activeTab === 'control' && (
          <div className={styles.bottomSheet}>
            <ControlPanel />
          </div>
        )}
        {activeTab === 'data' && (
          <div className={styles.bottomSheet}>
            <DataPanel />
          </div>
        )}
        {activeTab === 'presets' && (
          <div className={styles.bottomSheet}>
            <PresetBar />
          </div>
        )}

        <nav className={styles.tabBar}>
          {(['control', 'data', 'presets'] as const).map((tab) => (
            <button
              key={tab}
              className={`${styles.tabButton} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab((t) => (t === tab ? null : tab))}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // ── Tablet layout ──────────────────────────────────────────────────────────
  if (tier === 'tablet') {
    const anyDrawerOpen = controlOpen || dataOpen;
    return (
      <div className={styles.tabletShell}>
        {anyDrawerOpen && (
          <div className={styles.overlay} onClick={closeAllDrawers} />
        )}

        <header className={styles.header}>
          <button
            className={styles.hamburger}
            onClick={() => { setControlOpen((o) => !o); setDataOpen(false); }}
            aria-label="Toggle control panel"
            aria-expanded={controlOpen}
          >
            <HamburgerIcon />
          </button>
          <span className={styles.title}>Trifecta</span>
          <ModeToggle />
          <button
            className={styles.dataPanelToggle}
            onClick={() => { setDataOpen((o) => !o); setControlOpen(false); }}
            aria-label="Toggle data panel"
            aria-expanded={dataOpen}
          >
            <DataIcon />
          </button>
        </header>

        <aside className={`${styles.leftDrawer} ${controlOpen ? styles.drawerOpen : ''}`}>
          <ControlPanel />
        </aside>

        <aside className={`${styles.rightDrawer} ${dataOpen ? styles.drawerOpen : ''}`}>
          <DataPanel />
        </aside>

        <main className={styles.canvas}>
          <CanvasStack onRefsReady={setCanvasRefs} />
        </main>

        <div className={styles.timeStrip}>
          <FilterBar />
          <TimeController />
        </div>

        <div className={styles.presetBar}>
          <PresetBar />
        </div>
      </div>
    );
  }

  // ── Desktop layout (≥1024px) ───────────────────────────────────────────────
  return (
    <div
      className={`${styles.shell} ${dataPanelOpen ? '' : styles.dataPanelCollapsed}`}
    >
      <header className={styles.header}>
        <span className={styles.title}>Trifecta</span>
        <ModeToggle />
      </header>

      <aside className={styles.sidebar}>
        <ControlPanel />
      </aside>

      <main className={styles.canvas}>
        <CanvasStack onRefsReady={setCanvasRefs} />
      </main>

      <div className={styles.timeStrip}>
        <FilterBar />
        <TimeController />
      </div>

      <aside className={styles.dataPanel}>
        <DataPanel />
      </aside>

      <div className={styles.presetBar}>
        <PresetBar />
      </div>
    </div>
  );
}

export default App;
