import { useEffect, useRef, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { dur, ease, prefersReducedMotion } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { cx } from '@/lib/utils';

/** Sets data-motion-paused so CSS loops stop when offscreen or in a hidden tab. */
export function useMotionPause<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;

    let inView = true;
    const apply = () => {
      node.dataset.motionPaused = !inView || document.hidden ? 'true' : 'false';
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        apply();
      },
      { threshold: 0.01 },
    );
    observer.observe(node);
    document.addEventListener('visibilitychange', apply);
    apply();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', apply);
      delete node.dataset.motionPaused;
    };
  }, [enabled]);
  return ref;
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  /** Optional accessible label; decorative by default. */
  label?: string;
}

export function Skeleton({ width, height = 14, borderRadius, className = '', label }: SkeletonProps) {
  const reduced = useReducedMotion();
  const pauseRef = useMotionPause<HTMLSpanElement>();
  const style: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius,
  };
  return (
    <motion.span
      ref={pauseRef}
      className={cx('skeleton', className)}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: dur.fast, ease: ease.out }}
    >
      {label && <span className="sr-only">{label}</span>}
    </motion.span>
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
