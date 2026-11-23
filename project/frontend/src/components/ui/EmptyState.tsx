import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, LoaderCircle, RotateCcw } from 'lucide-react';
import { getErrorMessage } from '@/lib/api';
import { cx } from '@/lib/utils';

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
  return (
    <div
      className={cx('state-block', busy && 'state-block--busy')}
      role={busy ? 'status' : undefined}
      aria-busy={busy || undefined}
      aria-live={busy ? 'polite' : undefined}
    >
      <div className="state-icon">
        {busy ? (
          <LoaderCircle size={22} className="state-spinner" aria-hidden="true" />
        ) : (
          <Inbox size={22} aria-hidden="true" />
        )}
      </div>
      <h3>{busy ? busyLabel : title}</h3>
      <p>{busy ? 'Please wait while we gather the latest information.' : description}</p>
      {!busy && action}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, title = 'We could not load this view', onRetry }: ErrorStateProps) {
  return (
    <div className="state-block" role="alert">
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
    </div>
  );
}
