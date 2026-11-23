import type { OrganizationMembership } from '@/types/domain';

/**
 * Resolves the membership for the active API scope. An account with no active
 * organization (for example a platform admin working unscoped) must not fall
 * back to the first membership it happens to have.
 */
export function activeMembership(
  memberships: readonly OrganizationMembership[] | undefined,
  organizationId: number | null,
): OrganizationMembership | undefined {
  if (organizationId === null) return undefined;
  return memberships?.find((membership) => membership.organizationId === organizationId);
}

export function organizationNameForScope(
  memberships: readonly OrganizationMembership[] | undefined,
  organizationId: number | null,
): string | undefined {
  return activeMembership(memberships, organizationId)?.organizationName;
}
