import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { animateCount, dur } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { Surface } from './Surface';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
  /** Opt-in count-up for numeric values; non-numeric values render unchanged. */
  animateValue?: boolean;
}

interface NumericValue {
  target: number;
  final: string;
  format: (value: number) => string;
}

/** Only plain numbers/numeric strings are eligible; no derived or invented stats. */
function numericValue(value: ReactNode): NumericValue | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { target: value, final: String(value), format: (next) => String(Math.round(next)) };
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!/^-?\d[\d,]*(?:\.\d+)?$/.test(raw)) return null;
  const target = Number(raw.replaceAll(',', ''));
  if (!Number.isFinite(target)) return null;

  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const grouped = raw.includes(',');
  const format = (next: number) =>
    grouped
      ? new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(next)
      : next.toFixed(decimals);
  return { target, final: raw, format };
}

function AnimatedStatValue({ value, reduced }: { value: NumericValue; reduced: boolean }) {
  const [display, setDisplay] = useState(() => (reduced ? value.final : value.format(0)));
  const current = useRef(reduced ? value.target : 0);

  useEffect(() => {
    const stop = animateCount({
      from: current.current,
      to: value.target,
      duration: reduced ? 0 : dur.slow * 1000,
      onUpdate: (next) => {
        current.current = next;
        setDisplay(value.format(next));
      },
    });
    return stop;
  }, [value, reduced]);

  return (
    <span className="stat-card__value-animated">
      <span className="sr-only">{value.final}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
  animateValue = false,
}: StatCardProps) {
  const reduced = useReducedMotion();
  const numeric = useMemo(() => (animateValue ? numericValue(value) : null), [animateValue, value]);

  return (
    <Surface
      className={cx('stat-card', tone !== 'default' && `stat-card--${tone}`, className)}
      padding="sm"
    >
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {icon && <span className="stat-card__icon" aria-hidden="true">{icon}</span>}
      </div>
      <strong className="stat-card__value">{numeric ? <AnimatedStatValue value={numeric} reduced={reduced} /> : value}</strong>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </Surface>
  );
}
