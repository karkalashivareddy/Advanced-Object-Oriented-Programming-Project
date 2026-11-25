import { describe, expect, it } from 'vitest';
import { humanize } from './utils';

describe('humanize', () => {
  it('separates camelCase API metric keys into readable labels', () => {
    expect(humanize('availableUnits')).toBe('Available Units');
    expect(humanize('pendingRequests')).toBe('Pending Requests');
    expect(humanize('expiringWithin7Days')).toBe('Expiring Within 7 Days');
  });

  it('still separates snake_case and kebab-case keys', () => {
    expect(humanize('blood_group')).toBe('Blood Group');
    expect(humanize('ready-for-dispatch')).toBe('Ready For Dispatch');
  });
});
