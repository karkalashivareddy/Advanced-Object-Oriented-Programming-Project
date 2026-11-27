import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Inbox, LoaderCircle, RotateCcw } from 'lucide-react';
import { getErrorMessage } from '@/lib/api';
import { dur, ease } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { cx } from '@/lib/utils';
import { useMotionPause } from './Skeleton';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Shows a busy label and spinner while a scoped request is in flight. */
  busy?: boolean;
  busyLabel?: string;
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'There are no records to display for the current selection.',
  action,
  busy = false,
  busyLabel = 'Loading records…',
}: EmptyStateProps) {
  const reduced = useReducedMotion();
  const pauseRef = useMotionPause<HTMLDivElement>(busy);
  return (
    <motion.div
      ref={pauseRef}
      className={cx('state-block', busy && 'state-block--busy')}
      role={busy ? 'status' : undefined}
      aria-busy={busy || undefined}
      aria-live={busy ? 'polite' : undefined}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.enter }}
    >
      <motion.div
        className="state-icon"
        initial={reduced ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: dur.base, ease: ease.out, delay: reduced ? 0 : 0.04 }}
      >
        {busy ? (
          <LoaderCircle size={22} className="state-spinner" aria-hidden="true" />
        ) : (
          <Inbox size={22} aria-hidden="true" />
        )}
      </motion.div>
      <h3>{busy ? busyLabel : title}</h3>
      <p>{busy ? 'Please wait while we gather the latest information.' : description}</p>
      {!busy && action && (
        <motion.div
          className="state-action"
          initial={false}
          whileHover={reduced ? undefined : { y: -1 }}
          transition={{ duration: dur.instant, ease: ease.out }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, title = 'We could not load this view', onRetry }: ErrorStateProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="state-block"
      role="alert"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.enter }}
    >
      <div className="state-icon state-icon-danger">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{getErrorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RotateCcw size={14} aria-hidden="true" /> Try again
        </button>
      )}
    </motion.div>
  );
}
