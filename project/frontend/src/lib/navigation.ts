import {
  Activity,
  Ambulance,
  Bell,
  Boxes,
  ClipboardList,
  Droplets,
  HeartHandshake,
  LayoutDashboard,
  PieChart,
  ScrollText,
  Settings2,
  TicketCheck,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type AccessRule } from './permissions';

export type NavGroup = 'Workspace' | 'Operations' | 'Insights' | 'Administration' | 'Account';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  group: NavGroup;
  rule?: AccessRule;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/app/dashboard',
    icon: LayoutDashboard,
    group: 'Workspace',
    description: 'Role-aware overview of your operational picture.',
  },
  {
    label: 'Inventory',
    to: '/app/inventory',
    icon: Boxes,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.INVENTORY_READ] },
    description: 'Track units, expiries, movements, and stock alerts.',
  },
  {
    label: 'Donors',
    to: '/app/donors',
    icon: Users,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.DONOR_READ, PERMISSIONS.DONOR_MANAGE] },
    description: 'Manage donor profiles, consents, and appointments.',
  },
  {
    label: 'Donations',
    to: '/app/donations',
    icon: HeartHandshake,
    group: 'Operations',
    rule: {
      permissions: [
        PERMISSIONS.SCREENING_REVIEW,
        PERMISSIONS.DONATION_APPROVE,
        PERMISSIONS.DONOR_READ,
      ],
    },
    description: 'Review screening and approve eligible donations.',
  },
  {
    label: 'Emergency requests',
    to: '/app/requests',
    icon: ClipboardList,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.REQUEST_READ, PERMISSIONS.REQUEST_CREATE] },
    description: 'Raise, review, and track urgent blood requests.',
  },
  {
    label: 'Allocations',
    to: '/app/allocations',
    icon: PieChart,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.ALLOCATION_REVIEW, PERMISSIONS.ALLOCATION_CONFIRM] },
    description: 'Review non-clinical allocation suggestions.',
  },
  {
    label: 'Reservations',
    to: '/app/reservations',
    icon: TicketCheck,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.RESERVATION_READ, PERMISSIONS.RESERVATION_CREATE] },
    description: 'Create and confirm time-bound unit holds.',
  },
  {
    label: 'Dispatch',
    to: '/app/dispatch',
    icon: Ambulance,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.DISPATCH_READ, PERMISSIONS.DISPATCH_CREATE] },
    description: 'Coordinate handover from reservation to delivery.',
  },
  {
    label: 'Notifications',
    to: '/app/notifications',
    icon: Bell,
    group: 'Workspace',
    rule: { permissions: [PERMISSIONS.NOTIFICATION_READ] },
    description: 'Read and manage your notifications.',
  },
  {
    label: 'Audit log',
    to: '/app/audit',
    icon: ScrollText,
    group: 'Insights',
    rule: { permissions: [PERMISSIONS.AUDIT_READ] },
    description: 'Inspect recorded actions and outcomes.',
  },
  {
    label: 'Analytics',
    to: '/app/analytics',
    icon: Activity,
    group: 'Insights',
    rule: { permissions: [PERMISSIONS.ANALYTICS_READ] },
    description: 'Explore inventory and fulfilment metrics.',
  },
  {
    label: 'Users',
    to: '/app/admin/users',
    icon: UserCog,
    group: 'Administration',
    rule: { permissions: [PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE] },
    description: 'Review accounts and manage account status.',
  },
  {
    label: 'Organizations',
    to: '/app/admin/organizations',
    icon: Settings2,
    group: 'Administration',
    rule: { permissions: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.ORGANIZATION_MANAGE] },
    description: 'Onboard and verify partner organizations.',
  },
  {
    label: 'Profile',
    to: '/app/profile',
    icon: UserRound,
    group: 'Account',
    description: 'Your identity, memberships, and password.',
  },
  {
    label: 'Nearby donor finder',
    to: '/app/donors/nearby',
    icon: Activity,
    group: 'Operations',
    rule: { permissions: [PERMISSIONS.DONOR_DISCOVERY_READ] },
    description: 'Search for consenting donors by approximate distance.',
  },
];

export const NAV_GROUPS: NavGroup[] = [
  'Workspace',
  'Operations',
  'Insights',
  'Administration',
  'Account',
];

export const QUICK_ACTIONS = [
  { label: 'Blood inventory', to: '/app/inventory', icon: Droplets, rule: NAV_ITEMS[1].rule },
  { label: 'Emergency requests', to: '/app/requests', icon: ClipboardList, rule: NAV_ITEMS[4].rule },
  { label: 'Donor records', to: '/app/donors', icon: Users, rule: NAV_ITEMS[2].rule },
];

export function ruleForPath(pathname: string): AccessRule | undefined {
  return NAV_ITEMS
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((left, right) => right.to.length - left.to.length)[0]?.rule;
}
