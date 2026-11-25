import { useEffect, useState } from 'react';

/**
 * One shared clock for countdowns and "updated a moment ago" labels.
 * A single timer per consumer keeps relative times consistent without
 * repeatedly reading Date.now() during render.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
