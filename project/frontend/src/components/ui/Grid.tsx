import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/lib/utils';

interface GridProps {
  children: ReactNode;
  columns?: 'auto' | 'stats' | 'two' | 'three';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
}

/** Auto-fitting grid. Children must be allowed to shrink to zero width. */
export function Grid({ children, columns = 'auto', gap = 'md', className, style }: GridProps) {
  return (
    <div className={cx('ll-grid', `ll-grid--${columns}`, `ll-grid--gap-${gap}`, className)} style={style}>
      {children}
    </div>
  );
}
