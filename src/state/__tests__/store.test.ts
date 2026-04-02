import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

function reset() {
  useStore.setState(useStore.getInitialState());
}

describe('Zustand store — core actions', () => {
  beforeEach(reset);

  // ─── setBodyProperty ───

  it('setBodyProperty updates the correct body and clears activePresetId', () => {
    useStore.setState({ activePresetId: 'figure-eight' });
    useStore.getState().setBodyProperty('r', 'mass', 5.0);

    const s = useStore.getState();
    expect(s.bodies[0].mass).toBe(5.0);
    expect(s.bodies[1].mass).toBe(1.0); // unchanged
    expect(s.activePresetId).toBeNull();
  });

  it('setBodyProperty updates vector properties', () => {
    useStore.getState().setBodyProperty('g', 'position', { x: 3, y: -2 });
    expect(useStore.getState().bodies[1].position).toEqual({ x: 3, y: -2 });
  });

  // ─── play / pause / togglePlayPause ───

  it('play sets isPlaying true', () => {
    useStore.getState().play();
    expect(useStore.getState().isPlaying).toBe(true);
  });

  it('pause sets isPlaying false', () => {
    useStore.getState().play();
    useStore.getState().pause();
    expect(useStore.getState().isPlaying).toBe(false);
  });

  it('togglePlayPause flips isPlaying', () => {
    const toggle = () => useStore.getState().togglePlayPause();
    toggle();
    expect(useStore.getState().isPlaying).toBe(true);
    toggle();
    expect(useStore.getState().isPlaying).toBe(false);
  });

  // ─── setSpeed ───

  it('setSpeed clamps to [0.1, 10.0]', () => {
    const { setSpeed } = useStore.getState();
    setSpeed(0.01);
    expect(useStore.getState().speed).toBe(0.1);
    setSpeed(99);
    expect(useStore.getState().speed).toBe(10.0);
    setSpeed(5.5);
    expect(useStore.getState().speed).toBe(5.5);
  });

  // ─── setGlobal ───

  it('setGlobal updates global config and clears activePresetId', () => {
    useStore.setState({ activePresetId: 'lagrange' });
    useStore.getState().setGlobal('G', 3.5);

    const s = useStore.getState();
    expect(s.globals.G).toBe(3.5);
    expect(s.activePresetId).toBeNull();
  });
});

describe('Zustand store — mode switching (SPECS.md §2.3)', () => {
  beforeEach(reset);

  it('starts in lab mode, paused', () => {
    const s = useStore.getState();
    expect(s.mode).toBe('lab');
    expect(s.isPlaying).toBe(false);
  });

  it('Lab → Live: commits staged, starts playing', () => {
    // Stage some custom values
    const { setStagedBodyProperty, setStagedGlobal, setMode } =
      useStore.getState();
    setStagedBodyProperty('r', 'mass', 7.0);
    setStagedGlobal('G', 2.0);

    setMode('live');

    const s = useStore.getState();
    expect(s.mode).toBe('live');
    expect(s.isPlaying).toBe(true);
    // Staged values should now be active
    expect(s.bodies[0].mass).toBe(7.0);
    expect(s.globals.G).toBe(2.0);
    // Initial conditions should be snapshotted to match the committed state
    expect(s.initialConditions.bodies[0].mass).toBe(7.0);
    expect(s.initialConditions.globals.G).toBe(2.0);
  });

  it('Live → Lab: pauses and snapshots active → staged', () => {
    // Get into live mode first
    useStore.getState().setMode('live');

    // Mutate active state while live
    useStore.getState().setBodyProperty('b', 'mass', 12.0);

    // Switch back to lab
    useStore.getState().setMode('lab');

    const s = useStore.getState();
    expect(s.mode).toBe('lab');
    expect(s.isPlaying).toBe(false);
    expect(s.stagedBodies).not.toBeNull();
    expect(s.stagedBodies![2].mass).toBe(12.0);
  });

  it('setMode is a no-op when target mode equals current mode', () => {
    useStore.getState().setMode('lab'); // already lab
    const s = useStore.getState();
    expect(s.mode).toBe('lab');
    expect(s.isPlaying).toBe(false);
    expect(s.stagedBodies).toBeNull(); // snapshotToStaged was NOT called
  });
});

describe('Zustand store — reset (SPECS.md §6.3)', () => {
  beforeEach(reset);

  it('reset restores initialConditions, clears time/trails/graph, pauses', () => {
    const state = useStore.getState();

    // Snapshot, then mutate
    state.snapshotInitialConditions();
    state.play();
    state.setBodyProperty('r', 'mass', 99);
    useStore.setState({ time: 42 });
    state.pushTrailPoint(0, { position: { x: 1, y: 2 }, timestamp: 1 });

    // Reset
    useStore.getState().reset();

    const s = useStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.time).toBe(0);
    expect(s.bodies[0].mass).toBe(1.0); // default
    expect(s.trailHistory[0]).toHaveLength(0);
    expect(s.graphHistory).toHaveLength(0);
  });
});

describe('Zustand store — staged slice', () => {
  beforeEach(reset);

  it('commitStaged copies staged → active, plays, and snapshots', () => {
    const state = useStore.getState();
    state.setStagedBodyProperty('g', 'mass', 50);
    state.commitStaged();

    const s = useStore.getState();
    expect(s.bodies[1].mass).toBe(50);
    expect(s.isPlaying).toBe(true);
    expect(s.initialConditions.bodies[1].mass).toBe(50);
  });

  it('commitStaged falls back to active state when staged is null', () => {
    // Don't set any staged values
    useStore.getState().commitStaged();

    const s = useStore.getState();
    expect(s.isPlaying).toBe(true);
    expect(s.bodies[0].mass).toBe(1.0); // default preserved
  });

  it('snapshotToStaged copies current active → staged', () => {
    useStore.getState().setBodyProperty('r', 'mass', 8);
    useStore.getState().snapshotToStaged();

    const s = useStore.getState();
    expect(s.stagedBodies![0].mass).toBe(8);
  });
});

describe('Zustand store — history slice', () => {
  beforeEach(reset);

  it('pushTrailPoint adds points and trims to trailLength', () => {
    const state = useStore.getState();
    const trailLength = state.globals.trailLength; // 500

    for (let i = 0; i < trailLength + 10; i++) {
      useStore
        .getState()
        .pushTrailPoint(0, { position: { x: i, y: 0 }, timestamp: i });
    }

    expect(useStore.getState().trailHistory[0]).toHaveLength(trailLength);
  });

  it('clearTrails empties all trail arrays', () => {
    useStore
      .getState()
      .pushTrailPoint(1, { position: { x: 0, y: 0 }, timestamp: 0 });
    useStore.getState().clearTrails();

    const trails = useStore.getState().trailHistory;
    expect(trails[0]).toHaveLength(0);
    expect(trails[1]).toHaveLength(0);
    expect(trails[2]).toHaveLength(0);
  });
});
