import type { JwtService } from '@nestjs/jwt';
import { SessionStatus } from '@seremoto/prisma-client';
import { TokenService, toSnapshot } from './token.service';
import { TokenExpiredError, TokenInvalidError } from '../../common/http/api-error';
import { hashToken } from '../../common/security/hashing';
import type { Environment } from '../../config/environment';
import type { PrismaService } from '../../common/database/prisma.service';

const USER = {
  id: 'user-1',
  fullName: 'Uwimana Eric',
  phone: '+250788123456',
  preferredLanguage: 'rw',
  roles: ['CUSTOMER'],
};

const META = { userAgent: 'Dart/3.5 (Android)', ipAddress: '41.74.10.5', deviceLabel: null };

function tokenEnv(): Environment {
  return { ACCESS_TOKEN_TTL: 900, REFRESH_TOKEN_TTL: 60 * 60 * 24 * 30 } as unknown as Environment;
}

interface SessionRow {
  id: string;
  userId: string;
  status: SessionStatus;
  expiresAt: Date;
  refreshTokenHash: string;
  user: typeof USER;
}

function build(options: { existing?: SessionRow | null } = {}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const updateMany: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];

  const session = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      return { id: `session-${created.length}`, ...data };
    }),
    findUnique: jest.fn(async () => options.existing ?? null),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      updated.push(data);
      return { id: 'session-old', ...data };
    }),
    updateMany: jest.fn(async (arg: Record<string, unknown>) => {
      updateMany.push(arg);
      return { count: 3 };
    }),
  };

  const auditLog = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      audits.push(data);
      return data;
    }),
  };

  const prisma = { session, auditLog };

  const jwt = {
    signAsync: jest.fn(async (payload: Record<string, unknown>) => {
      const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `fake.${raw}.sig`;
    }),
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'expired') {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      }
      if (token === 'garbage') throw new Error('bad signature');
      const [, payload] = token.split('.');
      return JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'));
    }),
  };

  const service = new TokenService(
    jwt as unknown as JwtService,
    prisma as unknown as PrismaService,
    tokenEnv(),
  );

  return { service, session, auditLog, created, updated, updateMany, audits, jwt };
}

function sessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-old',
    userId: USER.id,
    status: SessionStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    refreshTokenHash: hashToken('refresh-secret'),
    user: USER,
    ...overrides,
  };
}

describe('TokenService.createSession', () => {
  it('persists only the SHA-256 hash of the refresh token', async () => {
    const { service, created } = build();
    const issued = await service.createSession(toSnapshot(USER), META);

    expect(created[0]).toMatchObject({
      userId: USER.id,
      status: SessionStatus.ACTIVE,
      refreshTokenHash: hashToken(issued.refreshToken),
    });
    expect(JSON.stringify(created[0])).not.toContain(issued.refreshToken);
    expect(issued.refreshTokenExpiresInSeconds).toBe(60 * 60 * 24 * 30);
    expect(issued.accessTokenExpiresInSeconds).toBe(900);
  });

  it('truncates an oversized user agent rather than failing the login', async () => {
    const { service, created } = build();
    await service.createSession(toSnapshot(USER), { userAgent: 'x'.repeat(900) });
    expect((created[0] as { userAgent: string }).userAgent).toHaveLength(500);
  });

  it('signs an access token that carries no roles or permissions', async () => {
    const { service, jwt } = build();
    await service.createSession(toSnapshot(USER), META);
    const payload = jwt.signAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['sid', 'sub', 'typ']);
  });

  it('rejects a token that is not an access token', async () => {
    const { service } = build();
    const refreshLike = `fake.${Buffer.from(JSON.stringify({ sub: 'u', sid: 's', typ: 'refresh' })).toString('base64url')}.sig`;
    await expect(service.verifyAccessToken(refreshLike)).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it('maps jwt expiry and tampering to distinct codes', async () => {
    const { service } = build();
    await expect(service.verifyAccessToken('expired')).rejects.toBeInstanceOf(TokenExpiredError);
    await expect(service.verifyAccessToken('garbage')).rejects.toBeInstanceOf(TokenInvalidError);
  });
});

describe('TokenService.rotateSession', () => {
  it('refuses an unknown refresh token', async () => {
    const { service } = build({ existing: null });
    await expect(service.rotateSession('never-issued', META)).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
  });

  it('treats a reused revoked token as theft and ends every session', async () => {
    const { service, updateMany, audits } = build({
      existing: sessionRow({ status: SessionStatus.REVOKED }),
    });
    await expect(service.rotateSession('refresh-secret', META)).rejects.toBeInstanceOf(
      TokenInvalidError,
    );
    expect(updateMany[0]).toMatchObject({
      where: { userId: USER.id, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedReason: 'TOKEN_REUSE' },
    });
    expect(audits[0]).toMatchObject({ action: 'auth.session.revoked_all', actorId: USER.id });
  });

  it('refuses a session past its expiry date', async () => {
    const { service } = build({
      existing: sessionRow({ expiresAt: new Date(Date.now() - 1000) }),
    });
    await expect(service.rotateSession('refresh-secret', META)).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it('issues a new session and marks the presented one as rotated', async () => {
    const { service, created, updated } = build({ existing: sessionRow() });
    const issued = await service.rotateSession('refresh-secret', META);

    expect(created).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      status: SessionStatus.REVOKED,
      revokedReason: 'ROTATED',
    });
    expect(issued.user.id).toBe(USER.id);
    expect(issued.refreshToken).not.toBe('refresh-secret');
  });
});

describe('TokenService.revokeSession', () => {
  it('only revokes a session owned by the caller', async () => {
    const { service, updateMany } = build();
    await service.revokeSession('session-old', 'user-1');
    expect(updateMany[0]).toMatchObject({
      where: { id: 'session-old', userId: 'user-1' },
      data: { revokedReason: 'LOGOUT' },
    });
  });

  it('ignores a failed touch instead of breaking an authenticated request', async () => {
    const { service, session } = build();
    session.update.mockRejectedValueOnce(new Error('row gone'));
    await expect(service.touchSession('session-old')).resolves.toBeUndefined();
  });
});
