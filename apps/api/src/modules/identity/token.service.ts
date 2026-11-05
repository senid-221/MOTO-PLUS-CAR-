import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserAccountSnapshot } from './account-snapshot';
import { randomId, hashToken } from '../../common/security/hashing';
import { TokenExpiredError, TokenInvalidError } from '../../common/http/api-error';
import type { Environment } from '../../config/environment';
import { ENV_TOKEN } from '../../config/env.module';
import { PrismaService } from '../../common/database/prisma.service';
import { SessionStatus } from '@seremoto/prisma-client';

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

export interface SessionMetadata {
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceLabel?: string | null;
}

/**
 * Access tokens are short-lived JWTs carrying only the user id and the session
 * id. Roles and permissions are read from the database on every request so a
 * suspension or role change takes effect immediately, not at token expiry.
 *
 * Refresh tokens are opaque random strings; only their SHA-256 hash is stored.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV_TOKEN)
    private readonly env: Environment,
  ) {}

  async createSession(user: UserAccountSnapshot, meta: SessionMetadata): Promise<IssuedSession> {
    const refreshToken = randomId(48);
    const now = Date.now();
    const expiresAt = new Date(now + this.env.REFRESH_TOKEN_TTL * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        status: SessionStatus.ACTIVE,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        ipAddress: meta.ipAddress ?? null,
        deviceLabel: meta.deviceLabel ?? null,
        expiresAt,
        lastUsedAt: new Date(now),
      },
    });

    return {
      sessionId: session.id,
      accessToken: await this.signAccessToken(user.id, session.id),
      refreshToken,
      accessTokenExpiresInSeconds: this.env.ACCESS_TOKEN_TTL,
      refreshTokenExpiresInSeconds: this.env.REFRESH_TOKEN_TTL,
    };
  }

  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, sid: sessionId, typ: 'access' });
  }

  /** Verifies an access token and returns its subject and session id. */
  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; typ: string }>(token);
      if (payload.typ !== 'access') {
        throw new TokenInvalidError('Token is not an access token');
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof TokenInvalidError) throw error;
      const name = (error as Error).name;
      if (name === 'TokenExpiredError') throw new TokenExpiredError();
      throw new TokenInvalidError('Access token is not valid');
    }
  }

  /**
   * Rotates a refresh token. Presenting an already revoked token is treated as
   * theft: the whole account's sessions are revoked and the event is audited.
   */
  async rotateSession(
    presentedRefreshToken: string,
    meta: SessionMetadata,
  ): Promise<IssuedSession & { user: UserAccountSnapshot }> {
    const hash = hashToken(presentedRefreshToken);
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });

    if (!existing) {
      throw new TokenInvalidError('Refresh token is not recognised');
    }

    if (existing.status === SessionStatus.REVOKED) {
      await this.prisma.session.updateMany({
        where: { userId: existing.userId, status: SessionStatus.ACTIVE },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: 'TOKEN_REUSE',
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: existing.userId,
          action: 'auth.session.revoked_all',
          entityType: 'Session',
          entityId: existing.id,
          metadata: { reason: 'TOKEN_REUSE', ipAddress: meta.ipAddress ?? null },
        },
      });
      throw new TokenInvalidError('Refresh token was already used. All sessions were ended.');
    }

    if (existing.status === SessionStatus.EXPIRED || existing.expiresAt.getTime() <= Date.now()) {
      throw new TokenExpiredError();
    }

    const issued = await this.createSession(toSnapshot(existing.user), meta);
    await this.prisma.session.update({
      where: { id: existing.id },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: 'ROTATED',
      },
    });

    return { ...issued, user: toSnapshot(existing.user) };
  }

  async revokeSession(sessionId: string, userId: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokedReason: reason },
    });
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.session
      .update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }
}

export function toSnapshot(user: {
  id: string;
  fullName: string;
  phone: string;
  preferredLanguage: string;
  roles: string[];
}): UserAccountSnapshot {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    preferredLanguage: user.preferredLanguage,
    roles: user.roles as UserAccountSnapshot['roles'],
  };
}
