import type {
  BloodGroup,
  ComponentType,
  DonorAvailability,
  EmergencyRequestPriority,
  Role,
  UnitStatus,
  UserStatus,
} from '@/types/domain';

export const BLOOD_GROUPS: BloodGroup[] = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
];

export const COMPONENT_TYPES: ComponentType[] = [
  'WHOLE_BLOOD',
  'RED_CELLS',
  'PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
];

export const UNIT_STATUSES: UnitStatus[] = [
  'COLLECTED',
  'SCREENING',
  'QUARANTINED',
  'AVAILABLE',
  'RESERVED',
  'DISPATCHED',
  'DELIVERED',
  'EXPIRED',
  'DISCARDED',
];

export const PRIORITIES: EmergencyRequestPriority[] = ['ROUTINE', 'URGENT', 'CRITICAL'];

export const REQUEST_STATUSES = [
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'APPROVED',
  'ALLOCATING',
  'RESERVED',
  'IN_TRANSIT',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
];

export const DONATION_STATUSES = ['RECORDED', 'SCREENED', 'APPROVED', 'REJECTED'];

export const RESERVATION_STATUSES = ['ACTIVE', 'CONFIRMED', 'CANCELLED', 'EXPIRED'];

export const DISPATCH_STATUSES = ['PREPARING', 'IN_TRANSIT', 'DELIVERED', 'INCIDENT'];

export const DONOR_AVAILABILITY: DonorAvailability[] = [
  'AVAILABLE',
  'TEMPORARILY_UNAVAILABLE',
  'UNAVAILABLE',
];

export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'PENDING_VERIFICATION', 'LOCKED', 'DISABLED'];

export const ROLES: Role[] = [
  'PLATFORM_ADMIN',
  'BLOOD_BANK_ADMIN',
  'INVENTORY_MANAGER',
  'HOSPITAL_ADMIN',
  'MEDICAL_STAFF',
  'DONOR',
];
