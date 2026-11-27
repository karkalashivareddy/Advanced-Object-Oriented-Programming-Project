import { useEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { cx } from '@/lib/utils';

interface OffscreenMotionPauseProps {
  children: ReactNode;
  className?: string;
}

/**
 * Pauses CSS loops and SMIL animation inside a decorative subtree whenever it
 * leaves the viewport or the tab is hidden. Transform/opacity only: no layout
 * properties are touched.
 */
export function OffscreenMotionPause({ children, className }: OffscreenMotionPauseProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;

    let inView = true;
    const apply = () => {
      const paused = !inView || document.hidden;
      node.dataset.motionPaused = paused ? 'true' : 'false';
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
        if (typeof svg.pauseAnimations !== 'function') return;
        if (paused) svg.pauseAnimations();
        else svg.unpauseAnimations();
      });
    };

    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            ([entry]) => {
              inView = Boolean(entry?.isIntersecting);
              apply();
            },
            { threshold: 0.02 },
          )
        : null;
    observer?.observe(node);

    const onVisibility = () => apply();
    document.addEventListener('visibilitychange', onVisibility);
    apply();

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      node.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
        if (typeof svg.unpauseAnimations === 'function') svg.unpauseAnimations();
      });
    };
  }, []);

  return (
    <div ref={ref} className={cx('ll-motion-boundary', className)}>
      {children}
    </div>
  );
}
