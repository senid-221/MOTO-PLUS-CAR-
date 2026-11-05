import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SELF_ASSIGNABLE_ROLES,
  SUPER_ADMIN_ROLES,
  can,
  permissionsForRoles,
  type Permission,
} from './permissions';
import { USER_ROLES, type UserRole } from './enums';

type Role = UserRole;

const STAFF_ROLES: Role[] = [
  'SUPPORT',
  'MODERATOR',
  'FINANCE',
  'OPERATIONS',
  'VERIFICATION_OFFICER',
  'CONTENT_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
];

describe('permission catalogue', () => {
  it('declares every key at most once', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('only assigns keys that exist in the catalogue', () => {
    const declared = new Set<string>(PERMISSIONS);
    const orphans: string[] = [];
    for (const [role, list] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of list) {
        if (!declared.has(permission)) orphans.push(`${role} -> ${permission}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('covers every role the database enum allows', () => {
    const mapped = Object.keys(ROLE_PERMISSIONS).sort();
    expect(mapped).toEqual([...USER_ROLES].sort());
  });
});

describe('role to permission assignment', () => {
  it('gives a super administrator the whole catalogue', () => {
    expect(permissionsForRoles(['SUPER_ADMIN'])).toEqual([...PERMISSIONS]);
  });

  it('keeps every administrative key away from self-service roles', () => {
    const selfRoles: Role[] = [
      'CUSTOMER',
      'RIDER',
      'MERCHANT',
      'GARAGE',
      'COOPERATIVE_MANAGER',
      'BUSINESS_CLIENT',
    ];
    for (const role of selfRoles) {
      const granted = permissionsForRoles([role]);
      expect(granted.filter((permission) => permission.startsWith('admin:'))).toEqual([]);
    }
  });

  it('unions roles on one account without repeating keys', () => {
    const both = permissionsForRoles(['CUSTOMER', 'RIDER']);
    expect(both).toContain('customer:booking:create');
    expect(both).toContain('rider:availability:update');
    expect(new Set(both).size).toBe(both.length);
  });

  it('assigns each staff persona the capabilities the product specification names', () => {
    expect(permissionsForRoles(['ADMIN'])).toEqual(
      expect.arrayContaining([
        'admin:staff:manage',
        'admin:settings:update',
        'admin:audit:read',
      ] satisfies Permission[]),
    );
    expect(permissionsForRoles(['OPERATIONS'])).toEqual(
      expect.arrayContaining(['admin:booking:read'] satisfies Permission[]),
    );
    expect(permissionsForRoles(['VERIFICATION_OFFICER'])).toEqual(
      expect.arrayContaining([
        'admin:rider:verify',
        'admin:cooperative:verify',
      ] satisfies Permission[]),
    );
    expect(permissionsForRoles(['SUPPORT'])).toEqual(
      expect.arrayContaining(['admin:complaint:manage', 'admin:user:read'] satisfies Permission[]),
    );
    expect(permissionsForRoles(['FINANCE'])).toEqual(
      expect.arrayContaining([
        'admin:payment:refund',
        'admin:commission:update',
      ] satisfies Permission[]),
    );
    expect(permissionsForRoles(['MODERATOR'])).toEqual(
      expect.arrayContaining([
        'admin:marketplace:moderate',
        'admin:subscription:manage',
      ] satisfies Permission[]),
    );
    expect(permissionsForRoles(['CONTENT_MANAGER'])).toEqual(
      expect.arrayContaining([
        'admin:content:manage',
        'admin:advertising:manage',
      ] satisfies Permission[]),
    );
  });

  it('keeps money and staff management out of the operational and content roles', () => {
    for (const role of ['OPERATIONS', 'CONTENT_MANAGER', 'MODERATOR'] as Role[]) {
      const granted = permissionsForRoles([role]);
      expect(granted).not.toContain('admin:payment:refund');
      expect(granted).not.toContain('admin:staff:manage');
      expect(granted).not.toContain('admin:settings:update');
    }
  });

  it('lets a content manager edit content but never verify riders', () => {
    const granted = permissionsForRoles(['CONTENT_MANAGER']);
    expect(granted).not.toContain('admin:rider:verify');
  });

  it('agrees between the single-role helper and the union helper', () => {
    for (const role of USER_ROLES) {
      expect(can(role, 'account:read')).toBe(permissionsForRoles([role]).includes('account:read'));
    }
  });
});

describe('privilege escalation guard', () => {
  it('never lets a self-registering user ask for a staff role', () => {
    for (const role of STAFF_ROLES) {
      expect(SELF_ASSIGNABLE_ROLES).not.toContain(role);
    }
  });

  it('allows the six roles that have a real onboarding flow', () => {
    expect([...SELF_ASSIGNABLE_ROLES].sort()).toEqual(
      ['BUSINESS_CLIENT', 'COOPERATIVE_MANAGER', 'CUSTOMER', 'GARAGE', 'MERCHANT', 'RIDER'].sort(),
    );
  });

  it('treats SUPER_ADMIN as the only unrestricted role', () => {
    expect(SUPER_ADMIN_ROLES).toEqual(['SUPER_ADMIN']);
    expect(permissionsForRoles(['ADMIN']).length).toBeLessThan(PERMISSIONS.length);
    expect(permissionsForRoles(['ADMIN', 'SUPER_ADMIN'])).toEqual([...PERMISSIONS]);
  });

  it('returns nothing for an unknown role instead of throwing', () => {
    expect(permissionsForRoles(['GHOST' as Role])).toEqual([]);
    expect(permissionsForRoles([])).toEqual([]);
  });
});
