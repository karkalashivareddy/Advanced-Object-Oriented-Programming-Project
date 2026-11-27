import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '@/lib/utils';
import { dur, ease, rise } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export function Reveal({ children, className, delay = 0, y = rise.y }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={cx('reveal', className)}>{children}</div>;

  return (
    <motion.div
      className={cx('reveal', className)}
      initial={{ opacity: rise.opacity, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: dur.base, ease: ease.enter, delay }}
    >
      {children}
    </motion.div>
  );
}
