import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useIsFetching } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { dur, ease } from '@/lib/motion';

/** Global route/query activity indicator using transform and opacity only. */
export function TopProgress() {
  const { pathname, key } = useLocation();
  const fetching = useIsFetching();
  const reduced = useReducedMotion();
  const [routeActive, setRouteActive] = useState(false);
  const firstRender = useRef(true);

  // BrowserRouter is intentionally kept; a router-state hook would require a
  // data router. This short-lived cue covers location changes and lazy routes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setRouteActive(true);
    const handle = window.setTimeout(() => setRouteActive(false), 420);
    return () => window.clearTimeout(handle);
  }, [pathname, key]);

  const active = routeActive || fetching > 0;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="top-progress"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.fast, ease: ease.out }}
        >
          <motion.span
            className="top-progress__bar"
            animate={reduced ? undefined : { x: ['-100%', '260%'] }}
            transition={{ duration: 1.1, ease: ease.flow, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
