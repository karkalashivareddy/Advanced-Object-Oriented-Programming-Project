import type { CSSProperties } from 'react';
import { cx } from '@/lib/utils';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  /** Optional accessible label; decorative by default. */
  label?: string;
}

export function Skeleton({ width, height = 14, borderRadius, className = '', label }: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius,
  };
  return (
    <span
      className={cx('skeleton', className)}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
    >
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function PageSkeleton({ rows = 5, label = 'Loading content' }: { rows?: number; label?: string }) {
  return (
    <div className="stack" aria-label={label} aria-busy="true" role="status">
      <span className="sr-only">{label}…</span>
      <div className="skeleton-lines">
        <Skeleton width={220} height={28} />
        <Skeleton width={340} height={14} />
      </div>
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="kpi-card" key={index}>
            <Skeleton width="55%" height={12} />
            <Skeleton width="40%" height={30} />
          </div>
        ))}
      </div>
      <div className="card card-pad">
        <div className="skeleton-lines">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} height={18} width={`${90 - index * 7}%`} />
          ))}
        </div>
      </div>
    </div>
  );
}
