import { useEffect, useState } from 'react';

/** Small, SSR-safe media-query subscription used for layout-only decisions. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);

  return matches;
}

/** The single breakpoint at which semantic tables switch to their card view. */
export function useCompactTable(): boolean {
  return useMediaQuery('(max-width: 700px)');
}
