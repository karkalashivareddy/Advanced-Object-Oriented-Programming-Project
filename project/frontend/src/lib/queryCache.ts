import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

/**
 * All audit reads use this root. `audit-logs` is only invalidated while older
 * caches from before the migration may still be present in a browser session.
 */
export const auditKeys = {
  all: ['audit'] as const,
  page: (organizationId: string, actorId: string, action: string, from: string, to: string, page: number) =>
    ['audit', organizationId, actorId, action, from, to, page] as const,
  donationScreening: (donationId: number | null, organizationId: number | null) =>
    ['audit', 'donation-screening', donationId, organizationId] as const,
};

const LEGACY_AUDIT_ROOT = 'audit-logs';

/** Domains whose data is aggregated by the dashboard and analytics pages. */
const DASHBOARD_DOMAINS = new Set<string>([
  'analytics',
  'donations',
  'donors',
  'inventory',
  'organizations',
  'requests',
  'reservations',
  'dispatches',
  'users',
]);

const ANALYTICS_DOMAINS = new Set<string>([
  'analytics',
  'donations',
  'donors',
  'inventory',
  'requests',
  'reservations',
  'dispatches',
]);

/**
 * Invalidates a domain root plus the views that read the same data. Dashboard
 * queries have a 15s stale time, so they must be marked stale by mutations on
 * other pages rather than waiting for a timed refetch after navigating back.
 */
export function invalidateDomains(queryClient: QueryClient, domains: readonly string[]): void {
  const roots = new Set<string>();
  domains.forEach((domain) => {
    roots.add(domain);
    if (domain === 'audit') roots.add(LEGACY_AUDIT_ROOT);
    if (DASHBOARD_DOMAINS.has(domain)) roots.add('dashboard');
    if (ANALYTICS_DOMAINS.has(domain)) roots.add('analytics');
  });
  roots.forEach((root) => {
    void queryClient.invalidateQueries({ queryKey: [root] });
  });
}

/** Convenience hook for mutations that need cross-page cache invalidation. */
export function useInvalidateDomains(): (domains: readonly string[]) => void {
  const queryClient = useQueryClient();
  return useCallback((domains: readonly string[]) => invalidateDomains(queryClient, domains), [queryClient]);
}
