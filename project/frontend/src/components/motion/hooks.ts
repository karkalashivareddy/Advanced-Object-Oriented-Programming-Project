import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { watchPageVisibility } from '@/lib/motion';

/** Manual scroll restoration keeps route transitions from flashing old positions. */
export function useScrollRestoration(): void {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
}

/** Keeps CSS loop animations paused while the tab is hidden. */
export function useMotionVisibility(): void {
  useEffect(watchPageVisibility, []);
}
