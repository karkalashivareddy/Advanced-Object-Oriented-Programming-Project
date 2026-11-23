export type Role =
  | 'PLATFORM_ADMIN'
  | 'BLOOD_BANK_ADMIN'
  | 'INVENTORY_MANAGER'
  | 'HOSPITAL_ADMIN'
  | 'MEDICAL_STAFF'
  | 'DONOR';

export type UserStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'LOCKED' | 'DISABLED';

export interface OrganizationMembership {
  organizationId: number;
  organizationName: string;
  role: Role;
}

export interface UserView {
  id: number;
  publicId: string;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: Role[];
  permissions: string[];
  memberships: OrganizationMembership[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserView;
}

export interface OrganizationView {
  id: number;
  publicId: string;
  name: string;
  type: 'BLOOD_BANK' | 'HOSPITAL';
  registrationCode: string;
  city: string;
  state: string;
  contactEmail: string;
  phone: string;
  verified: boolean;
  active: boolean;
  serviceArea?: string;
}

export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

export type ComponentType =
  | 'WHOLE_BLOOD'
  | 'RED_CELLS'
  | 'PLASMA'
  | 'PLATELETS'
  | 'CRYOPRECIPITATE';

export type UnitStatus =
  | 'COLLECTED'
  | 'SCREENING'
  | 'QUARANTINED'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'EXPIRED'
  | 'DISCARDED';

export interface BloodUnitView {
  id: number;
  publicId: string;
  unitNumber: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  status: UnitStatus;
  released: boolean;
  collectedAt: string;
  expiresAt?: string;
  storageLocation: string;
  organizationId: number;
  donationId?: number;
  version: number;
}

export interface CreateUnitRequest {
  organizationId: number;
  unitNumber: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  collectedAt: string;
  expiresAt?: string;
  storageLocation: string;
}

export interface InventoryAdjustmentRequest {
  unitId: number;
  delta?: number;
  reason: string;
  location?: string;
}

export interface MovementView {
  id: number;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  occurredAt: string;
}

export interface InventoryAlerts {
  expiringSoon: number;
  expired: number;
  lowStockOrganizations: number;
}

export type DonorAvailability = 'AVAILABLE' | 'TEMPORARILY_UNAVAILABLE' | 'UNAVAILABLE';

export interface DonorView {
  id: number;
  publicId: string;
  userId: number;
  fullName: string;
  email: string;
  bloodGroup: BloodGroup;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  preferredContact?: string;
  availability?: DonorAvailability;
}

export interface CreateDonorRequest {
  userId: number;
  bloodGroup: BloodGroup;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  preferredContact?: string;
}

export interface UpdateDonorRequest {
  address?: string;
  city?: string;
  state?: string;
  preferredContact?: string;
  availability?: DonorAvailability;
}

export interface ConsentView {
  id: number;
  type: string;
  granted: boolean;
  grantedAt?: string;
  withdrawnAt?: string;
}

export interface AppointmentView {
  id: number;
  publicId?: string;
  donorId: number;
  organizationId: number;
  organizationName?: string;
  scheduledAt: string;
  status: string;
  notes?: string;
}

export interface DonationView {
  id: number;
  publicId?: string;
  donorId: number;
  donorName?: string;
  organizationId: number;
  appointmentId?: number;
  donatedAt: string;
  status: string;
  notes?: string;
}

export type EmergencyRequestPriority = 'ROUTINE' | 'URGENT' | 'CRITICAL';

export interface EmergencyRequestView {
  id: number;
  publicId?: string;
  requestNumber: string;
  organizationId: number;
  organizationName?: string;
  patientRef?: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  quantity: number;
  priority: EmergencyRequestPriority;
  requiredBy: string;
  status: string;
  reason?: string;
}

export interface EmergencyRequestEventView {
  id: number;
  action: string;
  notes?: string;
  actorId?: number;
  occurredAt: string;
}

export interface EmergencyRequestDetail {
  request: EmergencyRequestView;
  events: EmergencyRequestEventView[];
}

export interface CreateEmergencyRequestRequest {
  organizationId: number;
  patientRef?: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  quantity: number;
  priority: EmergencyRequestPriority;
  requiredBy: string;
  reason?: string;
}

/** The API returns each candidate as an evaluated blood unit. */
export interface AllocationCandidateView {
  unit: BloodUnitView;
  eligible: boolean;
  rejectionReasons: string[];
  rank: number;
}

export interface AllocationSuggestion {
  requestId: number;
  ruleVersion: string;
  compatibilityRule: string;
  humanApprovalRequired: boolean;
  feasibility: string;
  candidates: AllocationCandidateView[];
}

export interface ReservationView {
  id: number;
  publicId: string;
  unitId: number;
  unitNumber: string;
  requestId: number;
  organizationId: number;
  status: string;
  expiresAt: string;
  confirmedAt?: string;
}

export interface DispatchView {
  id: number;
  publicId: string;
  reservationId: number;
  requestId: number;
  organizationId: number;
  assignedStaff: string;
  status: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  recipientName?: string;
  incidentDescription?: string;
}

export interface NotificationView {
  id: number;
  publicId: string;
  title: string;
  body: string;
  type: string;
  channel: string;
  status: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogView {
  id: number;
  actorId?: number;
  organizationId?: number;
  action: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  metadata?: string;
  outcome: string;
  occurredAt: string;
}

/** Analytics payloads are intentionally permissive: new metrics must not break the UI. */
export interface AnalyticsOverview {
  [key: string]: unknown;
}

export interface AnalyticsSeries {
  labels?: string[];
  name?: string;
  value?: number;
  [key: string]: unknown;
}
