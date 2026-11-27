import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '@/lib/utils';
import { dur, ease, rise, stagger } from '@/lib/motion';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  gap?: keyof typeof stagger;
  delay?: number;
}

export function Stagger({ children, className, itemClassName, gap = 'base', delay = 0 }: StaggerProps) {
  const reduced = useReducedMotion();
  const items = Array.isArray(children) ? children : [children];

  if (reduced) return <div className={cx('stagger', className)}>{children}</div>;

  return (
    <motion.div
      className={cx('stagger', className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger[gap], delayChildren: delay } },
      }}
    >
      {items.map((child, index) => (
        <motion.div
          // Static list order; index is a stable key for this one-shot wrapper.
          key={index}
          className={itemClassName}
          variants={{
            hidden: { opacity: rise.opacity, y: rise.y },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: dur.base, ease: ease.enter },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
