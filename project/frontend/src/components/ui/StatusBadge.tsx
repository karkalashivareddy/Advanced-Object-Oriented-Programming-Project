import { humanize } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const TONES: Record<BadgeTone, readonly string[]> = {
  success: [
    'ACTIVE',
    'AVAILABLE',
    'DELIVERED',
    'APPROVED',
    'CONFIRMED',
    'COMPLETED',
    'VERIFIED',
    'PASSED',
    'SUCCESS',
    'FULFILLED',
  ],
  warning: [
    'PENDING',
    'PENDING_VERIFICATION',
    'SCREENING',
    'QUARANTINED',
    'COLLECTED',
    'IN_TRANSIT',
    'SCHEDULED',
    'EXPIRING',
    'REQUESTED',
    'LOW',
  ],
  info: ['RESERVED', 'DISPATCHED', 'IN_PROGRESS', 'REVIEW', 'OPEN', 'MEDIUM'],
  danger: [
    'EXPIRED',
    'DISCARDED',
    'REJECTED',
    'CANCELLED',
    'DISABLED',
    'LOCKED',
    'FAILED',
    'FAILED_DELIVERY',
    'CRITICAL',
    'HIGH',
    'BREACH',
  ],
  neutral: ['DRAFT', 'CLOSED', 'UNKNOWN'],
};

export function toneForStatus(status: string): BadgeTone {
  const value = status.toUpperCase();
  return (Object.keys(TONES) as BadgeTone[]).find(
    (tone) => tone !== 'neutral' && TONES[tone].includes(value),
  ) ?? 'neutral';
}

interface StatusBadgeProps {
  status?: string | null;
  label?: string;
  tone?: BadgeTone;
  showDot?: boolean;
}

export function StatusBadge({ status, label, tone, showDot = true }: StatusBadgeProps) {
  const text = label ?? humanize(status);
  const resolvedTone = tone ?? toneForStatus(status ?? '');
  return (
    <span className={`badge badge-${resolvedTone}`}>
      {showDot && <span className="badge-dot" aria-hidden="true" />}
      {text}
    </span>
  );
}
