import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { useReducedMotion } from '@/lib/useReducedMotion';

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/** Subtle pointer attraction for hero actions; inert for touch and reduced motion. */
export function Magnetic({ children, className, strength = 6 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const frame = useRef(0);
  const reduced = useReducedMotion();

  const reset = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--magnetic-x', '0px');
      ref.current?.style.setProperty('--magnetic-y', '0px');
    });
  };

  const move = (event: PointerEvent<HTMLSpanElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * strength;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * strength;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty('--magnetic-x', `${x.toFixed(2)}px`);
      node.style.setProperty('--magnetic-y', `${y.toFixed(2)}px`);
    });
  };

  const style = { '--magnetic-x': '0px', '--magnetic-y': '0px' } as CSSProperties;

  return (
    <span
      ref={ref}
      className={cx('magnetic', className)}
      style={style}
      onPointerMove={move}
      onPointerLeave={reset}
      onBlur={reset}
    >
      {children}
    </span>
  );
}
