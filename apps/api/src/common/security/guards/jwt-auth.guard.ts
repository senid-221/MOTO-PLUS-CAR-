import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { permissionsForRoles, type Permission, type UserRole } from '@seremoto/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from '../../../modules/identity/token.service';
import { AccountNotActiveError, ForbiddenError, UnauthenticatedError } from '../../http/api-error';
import { type AuthenticatedUser, IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * Authenticates the bearer token and authorises the route in one place:
 * roles, permissions and account status are read from PostgreSQL on every
 * request, so a suspension or role change is enforced immediately rather than
 * at token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private static readonly TOUCH_INTERVAL_MS = 60_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthenticatedError();
    }

    let subject: { userId: string; sessionId: string };
    try {
      subject = await this.tokens.verifyAccessToken(token);
    } catch (error) {
      // A bad token on a public route is ignored; on a protected one it is fatal.
      if (isPublic) return true;
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: subject.userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        preferredLanguage: true,
        status: true,
        roles: true,
        sessions: {
          where: { id: subject.sessionId },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            lastUsedAt: true,
          },
        },
      },
    });

    if (!user) throw new UnauthenticatedError('Account no longer exists');

    const session = user.sessions[0];
    if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() <= Date.now()) {
      throw new AccountNotActiveError('This session is no longer active. Log in again.');
    }

    if (user.status !== 'ACTIVE') {
      throw new AccountNotActiveError(
        user.status === 'PENDING'
          ? 'Verify your phone number to continue.'
          : 'This account is suspended. Contact support.',
      );
    }

    const roles = user.roles as UserRole[];
    const authenticated: AuthenticatedUser = {
      userId: user.id,
      sessionId: session.id,
      phone: user.phone,
      fullName: user.fullName,
      preferredLanguage: user.preferredLanguage,
      roles,
      permissions: permissionsForRoles(roles) as Permission[],
    };
    request.user = authenticated;

    if (Date.now() - session.lastUsedAt.getTime() > JwtAuthGuard.TOUCH_INTERVAL_MS) {
      await this.tokens.touchSession(session.id);
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.some((role) => roles.includes(role))) {
      throw new ForbiddenError();
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      requiredPermissions?.length &&
      !requiredPermissions.every((permission) => authenticated.permissions.includes(permission))
    ) {
      throw new ForbiddenError();
    }

    return true;
  }
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || !/^Bearer$/i.test(scheme) || !value) return null;
  return value.trim();
}
