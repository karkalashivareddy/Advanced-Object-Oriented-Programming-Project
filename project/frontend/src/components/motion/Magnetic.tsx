import { useRef, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { cx } from '@/lib/utils';
import { spring } from '@/lib/motion';

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export function Magnetic({ children, className, strength = 6 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, spring);
  const y = useSpring(rawY, spring);

  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    rawX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * strength);
    rawY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * strength);
  };

  const reset = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.span
      ref={ref}
      className={cx('ll-magnetic', className)}
      style={reduced ? undefined : { x, y }}
      onPointerMove={move}
      onPointerLeave={reset}
      onBlur={reset}
    >
      {children}
    </motion.span>
  );
}
