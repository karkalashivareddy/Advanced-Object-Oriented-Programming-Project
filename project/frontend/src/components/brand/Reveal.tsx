import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { prefersReducedMotion } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Reveals content once. Reduced-motion users and non-IO browsers get it immediately. */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties;

  return (
    <div
      ref={ref}
      className={cx('reveal', className)}
      data-visible={visible || reduced ? 'true' : 'false'}
      style={style}
    >
      {children}
    </div>
  );
}
