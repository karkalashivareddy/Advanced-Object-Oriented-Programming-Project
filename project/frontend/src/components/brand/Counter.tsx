import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/utils';
import { animateCount } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';

interface CounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function Counter({ value, suffix = '', duration = 720, className }: CounterProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  const format = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  useEffect(() => {
    const stop = animateCount({
      from: current.current,
      to: value,
      duration: reduced ? 0 : duration,
      onUpdate: (next) => {
        const rounded = Math.round(next);
        current.current = rounded;
        setDisplay(rounded);
      },
    });
    return stop;
  }, [value, duration, reduced]);

  return (
    <span className={cx('counter', className)}>
      <span className="sr-only">{format.format(value)}{suffix}</span>
      <span aria-hidden="true">{format.format(display)}{suffix}</span>
    </span>
  );
}
