import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';

/** Fixed reading-progress line. Scale-only transform; no layout animation. */
export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 28, restDelta: 0.001 });

  if (reduced) return null;
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}
