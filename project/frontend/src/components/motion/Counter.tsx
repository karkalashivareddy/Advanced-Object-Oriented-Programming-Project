import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/utils';
import { animateCount, dur } from '@/lib/motion';

interface CounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function Counter({ value, suffix = '', duration = dur.slow * 1000, className }: CounterProps) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  const format = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

  useEffect(() => {
    const stop = animateCount({
      from: current.current,
      to: value,
      duration,
      onUpdate: (next) => {
        const rounded = Math.round(next);
        current.current = rounded;
        setDisplay(rounded);
      },
    });
    return stop;
  }, [value, duration]);

  return (
    <span className={cx('counter', className)}>
      <span className="sr-only">{format.format(value)}{suffix}</span>
      <span aria-hidden="true">{format.format(display)}{suffix}</span>
    </span>
  );
}
