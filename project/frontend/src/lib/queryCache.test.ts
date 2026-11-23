import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { auditKeys, invalidateDomains } from './queryCache';

function seededClient(keys: readonly (readonly unknown[])[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  keys.forEach((key) => client.setQueryData(key, 'cached'));
  return client;
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

describe('invalidateDomains', () => {
  it('marks the domain, dashboard and analytics caches stale after a mutation', () => {
    const client = seededClient([
      ['donations', 'list'],
      ['dashboard', 'donations', 'review', 7],
      ['dashboard', 'donors', 'self', 3],
      ['analytics', 'overview', 'page', 7],
      ['notifications', 'list'],
    ]);

    invalidateDomains(client, ['donations']);

    expect(isInvalidated(client, ['donations', 'list'])).toBe(true);
    expect(isInvalidated(client, ['dashboard', 'donations', 'review', 7])).toBe(true);
    expect(isInvalidated(client, ['dashboard', 'donors', 'self', 3])).toBe(true);
    expect(isInvalidated(client, ['analytics', 'overview', 'page', 7])).toBe(true);
    expect(isInvalidated(client, ['notifications', 'list'])).toBe(false);
  });

  it('invalidates both audit roots during the cache-key migration', () => {
    const client = seededClient([
      auditKeys.page('', '', '', '', '', 0),
      auditKeys.donationScreening(12, 7),
      ['audit-logs', 'donation-screening', 12, 7],
    ]);

    invalidateDomains(client, ['audit']);

    expect(isInvalidated(client, auditKeys.page('', '', '', '', '', 0))).toBe(true);
    expect(isInvalidated(client, auditKeys.donationScreening(12, 7))).toBe(true);
    expect(isInvalidated(client, ['audit-logs', 'donation-screening', 12, 7])).toBe(true);
  });

  it('uses one audit root for screening queries', () => {
    expect(auditKeys.donationScreening(12, 7)).toEqual(['audit', 'donation-screening', 12, 7]);
    expect(auditKeys.all).toEqual(['audit']);
  });
});
