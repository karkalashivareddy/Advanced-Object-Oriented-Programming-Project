import { useId } from 'react';
import { cx } from '@/lib/utils';

interface BloodDropProps {
  className?: string;
  size?: number;
  title?: string;
}

/** A single red cell as a drop: the smallest repeatable unit of the identity. */
export function BloodDrop({ className, size = 28, title }: BloodDropProps) {
  const id = useId().replace(/:/g, '');
  const gradientId = `drop-${id}`;

  return (
    <svg
      className={cx('blood-drop', className)}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff6b78" />
          <stop offset="0.5" stopColor="#c8102e" />
          <stop offset="1" stopColor="#6d1026" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.6c3.7 5.1 10.4 11.3 10.4 17.1A10.4 10.4 0 0 1 16 30a10.4 10.4 0 0 1-10.4-10.3C5.6 13.9 12.3 7.7 16 2.6Z"
        fill={`url(#${gradientId})`}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <path d="M8.8 20.1c3.5 2.4 10.8 2.3 14.4-1.1" fill="none" stroke="#fff" strokeOpacity="0.72" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
