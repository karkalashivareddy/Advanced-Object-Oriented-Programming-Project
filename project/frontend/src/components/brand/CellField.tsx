import type { CSSProperties } from 'react';
import { cx } from '@/lib/utils';

interface CellFieldProps {
  className?: string;
  dense?: boolean;
}

const CELLS = [
  { x: 8, y: 76, size: 26, delay: -1.2, duration: 18 },
  { x: 21, y: 44, size: 17, delay: -5.5, duration: 21 },
  { x: 34, y: 68, size: 31, delay: -9, duration: 16 },
  { x: 47, y: 34, size: 20, delay: -3.4, duration: 23 },
  { x: 59, y: 72, size: 24, delay: -12, duration: 19 },
  { x: 71, y: 42, size: 15, delay: -7.2, duration: 17 },
  { x: 83, y: 66, size: 28, delay: -14, duration: 22 },
  { x: 93, y: 31, size: 18, delay: -2.1, duration: 20 },
];

/** Decorative red-cell drift. Pure CSS so it can be paused without JavaScript. */
export function CellField({ className, dense = false }: CellFieldProps) {
  return (
    <div className={cx('cell-field', dense && 'cell-field--dense', className)} aria-hidden="true">
      {CELLS.map((cell) => (
        <span
          key={cell.x}
          className="cell-field__cell"
          style={
            {
              '--cell-x': `${cell.x}%`,
              '--cell-y': `${cell.y}%`,
              '--cell-size': `${cell.size}px`,
              '--cell-delay': `${cell.delay}s`,
              '--cell-duration': `${cell.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
