import { humanize } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'teal'
  | 'violet';

const TONES: Record<BadgeTone, readonly string[]> = {
  success: [
    'ACTIVE',
    'AVAILABLE',
    'DELIVERED',
    'APPROVED',
    'DONATION_APPROVED',
    'CONFIRMED',
    'COMPLETED',
    'VERIFIED',
    'PASSED',
    'SUCCESS',
    'FULFILLED',
  ],
  teal: [
    'RECORDED',
    'DONATION_RECORDED',
    'SCREENED',
    'DONATION_SCREENED',
    'DONATED',
    'COLLECTED',
    'DONOR_AVAILABLE',
  ],
  warning: [
    'PENDING',
    'PENDING_VERIFICATION',
    'SCREENING',
    'QUARANTINED',
    'TEMPORARILY_UNAVAILABLE',
    'PREPARING',
    'SCHEDULED',
    'EXPIRING',
    'REQUESTED',
    'LOW',
    'AWAITING_SCREENING',
  ],
  info: [
    'RESERVED',
    'DISPATCHED',
    'IN_PROGRESS',
    'REVIEW',
    'OPEN',
    'MEDIUM',
    'IN_TRANSIT',
    'ALLOCATING',
  ],
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
    'INCIDENT',
    'UNAVAILABLE',
    'DONOR_UNAVAILABLE',
  ],
  violet: ['PREPARING_DISPATCH', 'ALLOCATED', 'HOLD', 'IN_REVIEW'],
  neutral: ['DRAFT', 'CLOSED', 'UNKNOWN', 'PENDING_DONOR'],
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
