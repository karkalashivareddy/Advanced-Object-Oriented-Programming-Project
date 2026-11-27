import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '@/lib/utils';
import { dur, ease } from '@/lib/motion';

interface PressScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function PressScale({ children, className, scale = 0.97 }: PressScaleProps) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className={cx('ll-press', className)}
      whileTap={reduced ? undefined : { scale }}
      transition={{ duration: dur.fast, ease: ease.out }}
    >
      {children}
    </motion.span>
  );
}
