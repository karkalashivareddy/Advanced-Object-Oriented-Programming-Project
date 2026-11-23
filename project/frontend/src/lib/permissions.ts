import type { Role, UserStatus } from '@/types/domain';

/** Names match the backend `Permission` enum. UI checks are advisory only. */
export const PERMISSIONS = {
  USER_READ: 'USER_READ',
  USER_MANAGE: 'USER_MANAGE',
  ORGANIZATION_READ: 'ORGANIZATION_READ',
  ORGANIZATION_MANAGE: 'ORGANIZATION_MANAGE',
  DONOR_READ: 'DONOR_READ',
  DONOR_MANAGE: 'DONOR_MANAGE',
  APPOINTMENT_MANAGE: 'APPOINTMENT_MANAGE',
  DONATION_READ: 'DONATION_READ',
  DONATION_RECORD: 'DONATION_RECORD',
  SCREENING_REVIEW: 'SCREENING_REVIEW',
  DONATION_APPROVE: 'DONATION_APPROVE',
  INVENTORY_READ: 'INVENTORY_READ',
  INVENTORY_WRITE: 'INVENTORY_WRITE',
  INVENTORY_RELEASE: 'INVENTORY_RELEASE',
  REQUEST_READ: 'REQUEST_READ',
  REQUEST_CREATE: 'REQUEST_CREATE',
  REQUEST_APPROVE: 'REQUEST_APPROVE',
  ALLOCATION_REVIEW: 'ALLOCATION_REVIEW',
  ALLOCATION_CONFIRM: 'ALLOCATION_CONFIRM',
  RESERVATION_READ: 'RESERVATION_READ',
  RESERVATION_CREATE: 'RESERVATION_CREATE',
  RESERVATION_CONFIRM: 'RESERVATION_CONFIRM',
  DISPATCH_READ: 'DISPATCH_READ',
  DISPATCH_CREATE: 'DISPATCH_CREATE',
  DISPATCH_MANAGE: 'DISPATCH_MANAGE',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  AUDIT_READ: 'AUDIT_READ',
  ANALYTICS_READ: 'ANALYTICS_READ',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

/** UI-only fallback for roles whose permissions have not been returned by the API yet.
 *  Server-side authorization remains authoritative (see API_CONTRACTS.md). */
const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  PLATFORM_ADMIN: Object.values(PERMISSIONS),
  BLOOD_BANK_ADMIN: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.DONOR_READ,
    PERMISSIONS.DONOR_MANAGE,
    PERMISSIONS.APPOINTMENT_MANAGE,
    PERMISSIONS.DONATION_READ,
    PERMISSIONS.DONATION_RECORD,
    PERMISSIONS.SCREENING_REVIEW,
    PERMISSIONS.DONATION_APPROVE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_WRITE,
    PERMISSIONS.INVENTORY_RELEASE,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.REQUEST_APPROVE,
    PERMISSIONS.ALLOCATION_REVIEW,
    PERMISSIONS.ALLOCATION_CONFIRM,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.RESERVATION_CREATE,
    PERMISSIONS.RESERVATION_CONFIRM,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DISPATCH_CREATE,
    PERMISSIONS.DISPATCH_MANAGE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  INVENTORY_MANAGER: [
    PERMISSIONS.DONOR_READ,
    PERMISSIONS.DONATION_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_WRITE,
    PERMISSIONS.INVENTORY_RELEASE,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.ALLOCATION_REVIEW,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  HOSPITAL_ADMIN: [
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.REQUEST_APPROVE,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.RESERVATION_CREATE,
    PERMISSIONS.RESERVATION_CONFIRM,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DISPATCH_CREATE,
    PERMISSIONS.DISPATCH_MANAGE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  MEDICAL_STAFF: [
    PERMISSIONS.DONOR_READ,
    PERMISSIONS.DONATION_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  DONOR: [
    PERMISSIONS.DONOR_READ,
    PERMISSIONS.DONOR_MANAGE,
    PERMISSIONS.DONATION_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
};

export interface AccessContext {
  roles: readonly Role[];
  permissions: readonly string[];
  status?: UserStatus;
}

export interface AccessRule {
  /** Any of these permissions grants access unless requireAll is true. */
  permissions?: readonly string[];
  roles?: readonly Role[];
  requireAll?: boolean;
}

export function hasRole(context: AccessContext, role: Role): boolean {
  return context.roles.includes(role);
}

export function hasAnyRole(context: AccessContext, roles: readonly Role[]): boolean {
  return roles.some((role) => hasRole(context, role));
}

export function hasPermission(context: AccessContext, permission: string): boolean {
  if (context.status && context.status !== 'ACTIVE') return false;
  if (hasRole(context, 'PLATFORM_ADMIN')) return true;
  if (context.permissions.includes(permission)) return true;
  return context.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false);
}

export function hasAnyPermission(context: AccessContext, permissions: readonly string[]): boolean {
  return permissions.some((permission) => hasPermission(context, permission));
}

export function canAccess(context: AccessContext, rule: AccessRule = {}): boolean {
  if (context.status && context.status !== 'ACTIVE') return false;
  if (rule.roles?.length && !hasAnyRole(context, rule.roles)) return false;
  if (!rule.permissions?.length) return true;
  return rule.requireAll
    ? rule.permissions.every((permission) => hasPermission(context, permission))
    : hasAnyPermission(context, rule.permissions);
}
