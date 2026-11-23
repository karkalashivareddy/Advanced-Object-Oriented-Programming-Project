import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cx } from '@/lib/utils';

interface FreshnessIndicatorProps {
  /** Timestamp of the last successful load. */
  updatedAt?: string | number | Date | null;
  refreshing?: boolean;
  /** Any refresh callback is accepted, including React Query's `refetch`. */
  onRefresh?: () => unknown;
  /** Refetch once the tab becomes visible again after being hidden. */
  refetchOnVisible?: boolean;
  /** Minimum time hidden before a visibility refetch (defaults to 30 seconds). */
  hiddenForMs?: number;
  label?: string;
  className?: string;
}

function timestampOf(value: FreshnessIndicatorProps['updatedAt']): number | null {
  if (value === null || value === undefined || value === '') return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function relativeAge(from: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Compact "Live • Updated Xs ago" indicator with manual and visibility refresh. */
export function FreshnessIndicator({
  updatedAt,
  refreshing = false,
  onRefresh,
  refetchOnVisible = false,
  hiddenForMs = 30_000,
  label = 'Live',
  className,
}: FreshnessIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());
  const hiddenAt = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const updated = timestampOf(updatedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Reset the displayed age whenever a fresh timestamp arrives.
    setNow(Date.now());
  }, [updatedAt]);

  useEffect(() => {
    if (!refetchOnVisible || !onRefresh || typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const hiddenFor = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (hiddenFor >= hiddenForMs) {
        void Promise.resolve(onRefreshRef.current?.()).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refetchOnVisible, onRefresh, hiddenForMs]);

  const age = updated === null ? 'Waiting for data' : `Updated ${relativeAge(updated, now)}`;

  return (
    <div className={cx('freshness', className)} data-refreshing={refreshing || undefined}>
      <span className="live-pill">
        <span className="live-dot" aria-hidden="true" />
        {label}
      </span>
      <span className="freshness-time" aria-live="off">
        {age}
      </span>
      {onRefresh && (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm freshness-refresh"
          aria-label="Refresh data"
          aria-busy={refreshing || undefined}
          disabled={refreshing}
          onClick={() => void Promise.resolve(onRefresh()).catch(() => undefined)}
        >
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? 'Refreshing data' : ''}
      </span>
    </div>
  );
}
