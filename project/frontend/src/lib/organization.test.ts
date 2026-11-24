import { describe, expect, it } from 'vitest';
import { activeMembership, organizationNameForScope, resolveOrganizationScope } from './organization';
import type { OrganizationMembership } from '@/types/domain';

const memberships: OrganizationMembership[] = [
  { organizationId: 10, organizationName: 'First bank', role: 'BLOOD_BANK_ADMIN' },
  { organizationId: 20, organizationName: 'Second bank', role: 'HOSPITAL_ADMIN' },
];

describe('organizationNameForScope', () => {
  it('resolves the name from the active organization, not the first membership', () => {
    expect(organizationNameForScope(memberships, 20)).toBe('Second bank');
    expect(activeMembership(memberships, 20)?.organizationId).toBe(20);
  });

  it('does not invent a scope for platform admins without an active organization', () => {
    expect(organizationNameForScope(memberships, null)).toBeUndefined();
    expect(organizationNameForScope([], null)).toBeUndefined();
    expect(organizationNameForScope(memberships, 999)).toBeUndefined();
  });

  it('restores only a valid stored scope, never a first membership', () => {
    expect(resolveOrganizationScope(memberships, 20)).toBe(20);
    expect(resolveOrganizationScope(memberships, 999)).toBeNull();
    expect(resolveOrganizationScope(memberships, null)).toBeNull();
    expect(resolveOrganizationScope([], null)).toBeNull();
  });
});
