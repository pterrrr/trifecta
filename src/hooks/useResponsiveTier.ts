import { useState, useEffect } from 'react';
import type { ResponsiveTier } from '../types/ui';

function getTier(width: number): ResponsiveTier {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function useResponsiveTier(): ResponsiveTier {
  const [tier, setTier] = useState<ResponsiveTier>(() => getTier(window.innerWidth));

  useEffect(() => {
    function handleResize() {
      setTier(getTier(window.innerWidth));
    }
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return tier;
}
