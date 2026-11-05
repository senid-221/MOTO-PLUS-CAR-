import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission, UserRole } from '@seremoto/shared-types';

export const IS_PUBLIC_KEY = 'sere:isPublic';
export const PERMISSIONS_KEY = 'sere:permissions';
export const ROLES_KEY = 'sere:roles';

/** Marks an endpoint as reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Endpoint requires every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Endpoint requires the caller to hold at least one listed role. */
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Request context attached by JwtAuthGuard after token and session checks. */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  phone: string;
  fullName: string;
  preferredLanguage: string;
  roles: UserRole[];
  permissions: Permission[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user as AuthenticatedUser;
  },
);
