export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Shared timing contract. All page/route work uses these values. */
export const dur = {
  instant: 0.09,
  fast: 0.16,
  base: 0.32,
  slow: 0.76,
} as const;

export const ease = {
  enter: [0.22, 1, 0.36, 1],
  out: [0.16, 1, 0.3, 1],
  flow: [0.45, 0, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const rise = {
  y: 16,
  opacity: 0,
} as const;

export const stagger = {
  tight: 0.055,
  base: 0.085,
  relaxed: 0.13,
} as const;

export const spring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

export const wipe = {
  duration: dur.base,
  ease: ease.enter,
} as const;

/** Synchronous check for the first render; React state follows in useReducedMotion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/** True when an animation should run at full strength. */
export function motionAllowed(): boolean {
  return !prefersReducedMotion();
}

interface CountOptions {
  from: number;
  to: number;
  duration: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

/** Small rAF counter used only for derived values, never for invented statistics. */
export function animateCount({ from, to, duration, onUpdate, onComplete }: CountOptions): () => void {
  if (prefersReducedMotion() || duration <= 0 || from === to) {
    onUpdate(to);
    onComplete?.();
    return () => undefined;
  }

  const start = performance.now();
  let frame = 0;

  const tick = (now: number) => {
    const elapsed = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    onUpdate(from + (to - from) * eased);
    if (elapsed < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  };

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** Keeps the CSS loop-pause contract in sync with tab visibility. */
export function watchPageVisibility(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const update = () => {
    document.body.dataset.pageHidden = document.hidden ? 'true' : 'false';
  };
  update();
  document.addEventListener('visibilitychange', update);
  return () => document.removeEventListener('visibilitychange', update);
}
