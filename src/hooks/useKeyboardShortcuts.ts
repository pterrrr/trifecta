import { useEffect } from 'react';
import { useStore } from '../state/store';
import { BASE_DT } from '../constants/physics';

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        useStore.getState().togglePlayPause();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        useStore.getState().reset();
      } else if (e.code === 'Period' || e.code === 'ArrowRight') {
        // Step forward when paused
        const { isPlaying, stepForward } = useStore.getState();
        if (!isPlaying) {
          e.preventDefault();
          stepForward(BASE_DT);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
