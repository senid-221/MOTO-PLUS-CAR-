import type { UserRole } from './enums';

/**
 * Permission keys used by API guards and by the web app to decide what to show.
 * Add a key here before wiring a protected endpoint to it.
 */
export const PERMISSIONS = [
  'account:read',
  'account:update',
  'session:manage',

  'rider:read_own',
  'rider:update_own',
  'rider:document:upload',
  'rider:availability:update',
  'rider:location:update',
  'rider:earnings:read_own',
  'rider:job:read_available',

  'customer:booking:create',
  'customer:booking:read_own',
  'customer:booking:cancel',

  'delivery:create',
  'delivery:read_own',

  'shopping:create',
  'shopping:read_own',

  'contract:create',
  'contract:read_own',

  'marketplace:catalogue:read',
  'merchant:product:manage',
  'merchant:order:manage',
  'merchant:settlement:read',

  'cooperative:manage_own',
  'cooperative:member:manage_own',
  'cooperative:announcement:publish',
  'cooperative:report:read_own',

  'support:ticket:create',
  'support:ticket:read_own',

  'admin:rider:verify',
  'admin:cooperative:verify',
  'admin:merchant:verify',
  'admin:user:read',
  'admin:user:manage',
  'admin:booking:read',
  'admin:payment:read',
  'admin:payment:refund',
  'admin:commission:update',
  'admin:marketplace:moderate',
  'admin:content:manage',
  'admin:advertising:manage',
  'admin:subscription:manage',
  'admin:complaint:manage',
  'admin:report:read',
  'admin:audit:read',
  'admin:staff:manage',
  'admin:settings:update',
  'analytics:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const SELF_SERVICE: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'customer:booking:create',
  'customer:booking:read_own',
  'customer:booking:cancel',
  'delivery:create',
  'delivery:read_own',
  'shopping:create',
  'shopping:read_own',
  'contract:create',
  'contract:read_own',
  'marketplace:catalogue:read',
  'support:ticket:create',
  'support:ticket:read_own',
];

const RIDER_SELF: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'rider:read_own',
  'rider:update_own',
  'rider:document:upload',
  'rider:availability:update',
  'rider:location:update',
  'rider:earnings:read_own',
  'rider:job:read_available',
  'marketplace:catalogue:read',
  'support:ticket:create',
  'support:ticket:read_own',
];

const MERCHANT_SELF: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'merchant:product:manage',
  'merchant:order:manage',
  'merchant:settlement:read',
  'marketplace:catalogue:read',
  'support:ticket:create',
  'support:ticket:read_own',
];

const GARAGE_SELF: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'marketplace:catalogue:read',
  'support:ticket:create',
  'support:ticket:read_own',
];

const COOPERATIVE_SELF: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'cooperative:manage_own',
  'cooperative:member:manage_own',
  'cooperative:announcement:publish',
  'cooperative:report:read_own',
  'support:ticket:create',
  'support:ticket:read_own',
];

const BUSINESS_SELF: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'contract:create',
  'contract:read_own',
  'delivery:create',
  'delivery:read_own',
  'marketplace:catalogue:read',
  'support:ticket:create',
  'support:ticket:read_own',
];

const OPERATIONAL: Permission[] = [
  'account:read',
  'account:update',
  'session:manage',
  'admin:booking:read',
  'admin:report:read',
  'analytics:read',
  'support:ticket:read_own',
];

const SUPPORT_STAFF: Permission[] = [
  ...OPERATIONAL,
  'admin:user:read',
  'admin:complaint:manage',
  'admin:payment:read',
];

const FINANCE_STAFF: Permission[] = [
  ...OPERATIONAL,
  'admin:payment:read',
  'admin:payment:refund',
  'admin:commission:update',
  'admin:report:read',
];

const MODERATION_STAFF: Permission[] = [
  ...OPERATIONAL,
  'admin:marketplace:moderate',
  'admin:content:manage',
  'admin:advertising:manage',
  'admin:subscription:manage',
];

const VERIFICATION_STAFF: Permission[] = [
  ...OPERATIONAL,
  'admin:rider:verify',
  'admin:cooperative:verify',
  'admin:merchant:verify',
];

const ADMIN_STAFF: Permission[] = [
  ...OPERATIONAL,
  ...SUPPORT_STAFF,
  ...FINANCE_STAFF,
  ...MODERATION_STAFF,
  ...VERIFICATION_STAFF,
  'admin:user:manage',
  'admin:audit:read',
  'admin:staff:manage',
  'admin:settings:update',
];

const unique = (list: readonly Permission[]): Permission[] => Array.from(new Set(list));

/**
 * Explicit role to permission assignment required by section 3.7.
 * SUPER_ADMIN is resolved separately as an unrestricted role.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  CUSTOMER: unique(SELF_SERVICE),
  RIDER: unique(RIDER_SELF),
  MERCHANT: unique(MERCHANT_SELF),
  GARAGE: unique(GARAGE_SELF),
  COOPERATIVE_MANAGER: unique(COOPERATIVE_SELF),
  BUSINESS_CLIENT: unique(BUSINESS_SELF),
  SUPPORT: unique(SUPPORT_STAFF),
  MODERATOR: unique(MODERATION_STAFF),
  FINANCE: unique(FINANCE_STAFF),
  OPERATIONS: unique(OPERATIONAL),
  VERIFICATION_OFFICER: unique(VERIFICATION_STAFF),
  CONTENT_MANAGER: unique([...OPERATIONAL, 'admin:content:manage', 'admin:advertising:manage']),
  ADMIN: unique(ADMIN_STAFF),
  SUPER_ADMIN: unique(PERMISSIONS),
};

export const SUPER_ADMIN_ROLES: readonly UserRole[] = ['SUPER_ADMIN'];

/**
 * Roles a self-registering user may request. Staff roles are never
 * self-assignable and must be granted by an administrator.
 */
export const SELF_ASSIGNABLE_ROLES: readonly UserRole[] = [
  'CUSTOMER',
  'RIDER',
  'MERCHANT',
  'GARAGE',
  'COOPERATIVE_MANAGER',
  'BUSINESS_CLIENT',
];

export function permissionsForRoles(roles: readonly UserRole[]): Permission[] {
  if (roles.some((role) => SUPER_ADMIN_ROLES.includes(role))) {
    return [...PERMISSIONS];
  }
  return unique(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
}

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
