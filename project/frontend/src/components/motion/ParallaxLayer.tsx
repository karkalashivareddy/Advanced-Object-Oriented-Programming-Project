import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { cx } from '@/lib/utils';

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  distance?: number;
}

export function ParallaxLayer({ children, className, distance = 24 }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div ref={ref} className={cx('ll-parallax', className)} style={reduced ? undefined : { y }}>
      {children}
    </motion.div>
  );
}
