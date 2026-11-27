import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { dur, ease } from '@/lib/motion';

/** One transform-only curtain sweep on route change. Never blocks input. */
export function BloodWipe() {
  const location = useLocation();
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        className="blood-wipe"
        aria-hidden="true"
        initial={{ x: '-101%' }}
        animate={{ x: '101%' }}
        exit={{ opacity: 0 }}
        transition={{ duration: dur.slow, ease: ease.enter, times: [0, 1] }}
      />
    </AnimatePresence>
  );
}
