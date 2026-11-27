import { useId } from 'react';
import { cx } from '@/lib/utils';

type LifelineVariant = 'hero' | 'divider' | 'status' | 'mini';

interface LifelinePathProps {
  variant?: LifelineVariant;
  label?: string;
  className?: string;
}

const PATHS: Record<LifelineVariant, string> = {
  hero:
    'M-20 214 C130 214 172 96 306 96 C438 96 452 202 586 202 C706 202 748 54 890 54 C1010 54 1054 154 1220 154',
  divider:
    'M-20 54 C120 54 164 16 286 16 C410 16 446 84 572 84 C696 84 734 28 860 28 C984 28 1050 70 1220 70',
  status:
    'M0 20 H54 L66 20 L74 6 L86 34 L96 14 L106 20 H170 L182 20 L190 8 L202 32 L212 18 H320',
  mini: 'M0 18 H28 L36 8 L46 26 L56 18 H120',
};

/** The single continuous motif: vein, ECG trace, and route on one path. */
export function LifelinePath({ variant = 'divider', label, className }: LifelinePathProps) {
  const id = useId().replace(/:/g, '');
  const gradientId = `lifeline-${id}`;
  const glowId = `lifeline-glow-${id}`;
  const path = PATHS[variant];
  const isStatus = variant === 'status' || variant === 'mini';

  return (
    <svg
      className={cx('lifeline-path', `lifeline-path--${variant}`, className)}
      viewBox={isStatus ? '0 0 320 40' : '0 0 1200 240'}
      preserveAspectRatio={isStatus ? 'xMinYMid meet' : 'none'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b0018" />
          <stop offset="0.36" stopColor="#ff5263" />
          <stop offset="0.62" stopColor="#c8102e" />
          <stop offset="1" stopColor="#ff8590" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-80%" width="140%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path className="lifeline-path__bed" d={path} />
      <path className="lifeline-path__glow" d={path} filter={`url(#${glowId})`} />
      <path className="lifeline-path__trace" d={path} stroke={`url(#${gradientId})`} pathLength="1" />
      {!isStatus && <circle className="lifeline-path__node" cx="306" cy="96" r="5" />}
      {!isStatus && <circle className="lifeline-path__node lifeline-path__node--late" cx="890" cy="54" r="4" />}
    </svg>
  );
}
