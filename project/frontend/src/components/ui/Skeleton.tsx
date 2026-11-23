import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width, height = 14, borderRadius, className = '' }: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius,
  };
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack" aria-label="Loading content" role="status">
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
