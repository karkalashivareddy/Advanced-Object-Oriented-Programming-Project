import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { dur, ease } from '@/lib/motion';

interface RouteTransitionProps {
  children: ReactNode;
}

export function RouteTransition({ children }: RouteTransitionProps) {
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    const supported = typeof document.startViewTransition === 'function';
    root.classList.toggle('has-view-transitions', supported);
    return () => root.classList.remove('has-view-transitions');
  }, []);

  if (reduced) return <div className="route-transition">{children}</div>;

  // Opacity-only enter. A keyed `motion.div` avoids AnimatePresence re-entering
  // the route after async shell state settles, which used to remount forms and
  // discard text typed immediately after navigation.
  return (
    <motion.div
      key={location.pathname}
      className="route-transition"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: dur.base, ease: ease.enter }}
    >
      {children}
    </motion.div>
  );
}
