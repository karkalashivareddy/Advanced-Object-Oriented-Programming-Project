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

/**
 * Restores only a previously valid explicit scope. No first-membership fallback
 * is allowed: a user with several memberships must choose a scope, while an
 * unscoped platform admin remains unscoped until an explicit selection is made.
 */
export function resolveOrganizationScope(
  memberships: readonly OrganizationMembership[] | undefined,
  storedOrganizationId: number | null,
): number | null {
  if (storedOrganizationId === null) return null;
  return memberships?.some((membership) => membership.organizationId === storedOrganizationId)
    ? storedOrganizationId
    : null;
}
