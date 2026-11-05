import type { CurrentUserSummary, Permission, UserRole } from '@seremoto/shared-types';
import { permissionsForRoles } from '@seremoto/shared-types';

/** The subset of a user row that authentication needs, without secrets. */
export interface UserAccountSnapshot {
  id: string;
  fullName: string;
  phone: string;
  preferredLanguage: string;
  roles: UserRole[];
}

/**
 * Builds the user object returned by /auth/me and the login responses.
 * Permissions are always derived from the current role assignment rather than
 * read from the token, so a revoked role cannot still grant access.
 */
export function toCurrentUserSummary(
  user: UserAccountSnapshot & {
    email: string | null;
    status: string;
    phoneVerifiedAt: Date | null;
  },
): CurrentUserSummary {
  const permissions: Permission[] = permissionsForRoles(user.roles);
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    status: user.status,
    roles: user.roles,
    permissions,
    phoneVerified: user.phoneVerifiedAt !== null,
  };
}
