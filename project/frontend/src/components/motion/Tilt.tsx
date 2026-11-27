import { useRef, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { cx } from '@/lib/utils';
import { spring } from '@/lib/motion';

interface TiltProps {
  children: ReactNode;
  className?: string;
  max?: number;
}

export function Tilt({ children, className, max = 4 }: TiltProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(rawX, spring);
  const rotateY = useSpring(rawY, spring);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    rawY.set(((event.clientX - bounds.left) / bounds.width - 0.5) * max * 2);
    rawX.set(((event.clientY - bounds.top) / bounds.height - 0.5) * -max * 2);
  };

  const reset = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={cx('ll-tilt', className)}
      style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={move}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
}
