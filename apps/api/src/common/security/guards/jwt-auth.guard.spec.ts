import { type Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators';
import {
  AccountNotActiveError,
  ForbiddenError,
  TokenExpiredError,
  UnauthenticatedError,
} from '../../http/api-error';
import type { PrismaService } from '../../database/prisma.service';
import type { TokenService } from '../../../modules/identity/token.service';

const USER_ID = 'user-1';
const SESSION_ID = 'session-1';

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request as unknown as Request }),
    getHandler: () => handler,
    getClass: () => AuthedController,
  };
}

class handler {}
class AuthedController {}

function build(options: {
  public?: boolean;
  permissions?: string[];
  roles?: string[];
  tokenResult?: { userId: string; sessionId: string };
  tokenError?: Error;
  user?: Record<string, unknown> | null;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.public ? true : undefined;
      if (key === PERMISSIONS_KEY) return options.permissions;
      if (key === ROLES_KEY) return options.roles;
      return undefined;
    }),
  };

  const tokens = {
    verifyAccessToken: jest.fn(async () => {
      if (options.tokenError) throw options.tokenError;
      return options.tokenResult ?? { userId: USER_ID, sessionId: SESSION_ID };
    }),
    touchSession: jest.fn(async () => undefined),
  };

  const user =
    options.user === undefined
      ? {
          id: USER_ID,
          fullName: 'Uwimana Eric',
          phone: '+250788123456',
          preferredLanguage: 'rw',
          status: 'ACTIVE',
          roles: ['CUSTOMER'],
          sessions: [
            {
              id: SESSION_ID,
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 600_000),
              lastUsedAt: new Date(),
            },
          ],
        }
      : options.user;

  const prisma = { user: { findUnique: jest.fn(async () => user) } };

  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    tokens as unknown as TokenService,
    prisma as unknown as PrismaService,
  );

  return { guard, tokens, prisma, reflector };
}

const bearer = { headers: { authorization: 'Bearer access.jwt' } };

describe('extractBearerToken', () => {
  it('reads a well-formed header', () => {
    expect(extractBearerToken({ headers: { authorization: 'Bearer abc' } } as Request)).toBe('abc');
  });

  it('ignores other schemes and malformed headers', () => {
    expect(extractBearerToken({ headers: {} } as Request)).toBeNull();
    expect(extractBearerToken({ headers: { authorization: 'Token abc' } } as Request)).toBeNull();
    expect(extractBearerToken({ headers: { authorization: 'Bearer' } } as Request)).toBeNull();
  });
});

describe('JwtAuthGuard authentication', () => {
  it('lets a public route through when there is no token', async () => {
    const { guard, tokens } = build({ public: true });
    await expect(guard.canActivate(contextFor({ headers: {} }) as never)).resolves.toBe(true);
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('demands a token on a protected route', async () => {
    const { guard } = build({});
    await expect(guard.canActivate(contextFor({ headers: {} }) as never)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('ignores a bad token on a public route so optional personalisation still works', async () => {
    const { guard } = build({ public: true, tokenError: new TokenExpiredError() });
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer stale' } }) as never),
    ).resolves.toBe(true);
  });

  it('propagates token failure on a protected route', async () => {
    const { guard } = build({ tokenError: new TokenExpiredError() });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it('rejects when the account disappeared', async () => {
    const { guard } = build({ user: null });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('rejects a revoked or expired session even with a valid token', async () => {
    const revoked = build({
      user: {
        id: USER_ID,
        fullName: 'Uwimana Eric',
        phone: '+250788123456',
        preferredLanguage: 'rw',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'REVOKED',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(),
          },
        ],
      },
    });
    await expect(revoked.guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      AccountNotActiveError,
    );

    const expired = build({
      user: {
        id: USER_ID,
        fullName: 'Uwimana Eric',
        phone: '+250788123456',
        preferredLanguage: 'rw',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() - 1000),
            lastUsedAt: new Date(),
          },
        ],
      },
    });
    await expect(expired.guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      AccountNotActiveError,
    );
  });

  it('tells an unverified user to verify the phone', async () => {
    const { guard } = build({
      user: {
        id: USER_ID,
        fullName: 'Uwimana Eric',
        phone: '+250788123456',
        preferredLanguage: 'rw',
        status: 'PENDING',
        roles: ['CUSTOMER'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(),
          },
        ],
      },
    });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toThrow(
      /Verify your phone number/,
    );
  });

  it('does not stamp lastUsedAt on every request', async () => {
    const fresh = build({});
    await fresh.guard.canActivate(contextFor(bearer) as never);
    expect(fresh.tokens.touchSession).not.toHaveBeenCalled();

    const idle = build({
      user: {
        id: USER_ID,
        fullName: 'Uwimana Eric',
        phone: '+250788123456',
        preferredLanguage: 'rw',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(Date.now() - 120_000),
          },
        ],
      },
    });
    await idle.guard.canActivate(contextFor(bearer) as never);
    expect(idle.tokens.touchSession).toHaveBeenCalledWith(SESSION_ID);
  });
});

describe('JwtAuthGuard authorization', () => {
  it('attaches permissions derived from the database roles', async () => {
    const { guard } = build({});
    const request: Record<string, unknown> = { ...bearer };
    await expect(guard.canActivate(contextFor(request) as never)).resolves.toBe(true);
    const user = request.user as { roles: string[]; permissions: string[] };
    expect(user.roles).toEqual(['CUSTOMER']);
    expect(user.permissions).toContain('account:update');
    expect(user.permissions).not.toContain('admin:user:read');
  });

  it('refuses a rider an administrator screen', async () => {
    const { guard } = build({
      user: {
        id: USER_ID,
        fullName: 'Mugisha Jean',
        phone: '+250788123456',
        preferredLanguage: 'rw',
        status: 'ACTIVE',
        roles: ['RIDER'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(),
          },
        ],
      },
      permissions: ['admin:user:read'],
    });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('refuses a role the caller does not hold', async () => {
    const { guard } = build({ roles: ['ADMIN'] });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('allows a super administrator everywhere', async () => {
    const { guard } = build({
      user: {
        id: USER_ID,
        fullName: 'Sere Boss',
        phone: '+250788123456',
        preferredLanguage: 'en',
        status: 'ACTIVE',
        roles: ['SUPER_ADMIN'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(),
          },
        ],
      },
      permissions: ['admin:settings:update', 'admin:payment:refund'],
    });
    await expect(guard.canActivate(contextFor(bearer) as never)).resolves.toBe(true);
  });

  it('refuses a finance officer who lacks the refund permission', async () => {
    const { guard } = build({
      user: {
        id: USER_ID,
        fullName: 'Umutoni Alice',
        phone: '+250788123456',
        preferredLanguage: 'en',
        status: 'ACTIVE',
        roles: ['FINANCE'],
        sessions: [
          {
            id: SESSION_ID,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 600_000),
            lastUsedAt: new Date(),
          },
        ],
      },
      permissions: ['admin:settings:update'],
    });
    await expect(guard.canActivate(contextFor(bearer) as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
