import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/** Pointer-following halo. Only CSS custom properties change; no layout properties animate. */
export function CursorHalo() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    const node = ref.current;
    if (!node) return;

    const move = (event: PointerEvent) => {
      node.style.setProperty('--halo-x', `${event.clientX}px`);
      node.style.setProperty('--halo-y', `${event.clientY}px`);
      node.style.setProperty('--halo-visible', '1');
    };
    const leave = () => node.style.setProperty('--halo-visible', '0');

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <div ref={ref} className="cursor-halo" aria-hidden="true" />;
}
