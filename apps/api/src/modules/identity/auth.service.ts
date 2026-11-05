import { Injectable, Logger } from '@nestjs/common';
import {
  AccountStatus as DbAccountStatus,
  OtpPurpose as DbOtpPurpose,
  SessionStatus as DbSessionStatus,
  type UserRole as DbUserRole,
} from '@seremoto/prisma-client';
import { hashToken } from '../../common/security/hashing';
import type { AuthSession, CurrentUserSummary } from '@seremoto/shared-types';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../../common/security/audit.service';
import { OtpService } from './otp.service';
import { TokenService, type SessionMetadata, toSnapshot } from './token.service';
import { toCurrentUserSummary } from './account-snapshot';
import {
  AccountNotActiveError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/http/api-error';
import type { Language, OtpPurposeName } from '@seremoto/shared-types';

export interface RequestMeta extends SessionMetadata {
  /** Included in the response only for the local log SMS stand-in. */
  exposeDevOtp: boolean;
}

export interface SessionOutcome {
  session: AuthSession;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
}

const PROFILE_CREATING_ROLES = ['CUSTOMER', 'RIDER'] as const;

/**
 * Prisma's OTP enum values are the same strings the API contract uses, so the
 * client can be told which purpose a code covers rather than guessing it.
 */
function toPurposeName(purpose: DbOtpPurpose): OtpPurposeName {
  return purpose as OtpPurposeName;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a PENDING account and sends the registration code. The account
   * becomes ACTIVE only after the phone is verified.
   */
  async register(
    input: {
      fullName: string;
      phone: string;
      preferredLanguage: Language;
      roles: string[];
    },
    meta: RequestMeta,
  ): Promise<{
    userId: string;
    phone: string;
    verificationRequired: boolean;
    expiresInSeconds: number;
    purpose: OtpPurposeName;
    devOtpCode?: string;
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { phone: input.phone },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === DbAccountStatus.PENDING) {
        // Let an unfinished registration continue instead of dead-ending the user.
        const delivery = await this.otp.request(
          input.phone,
          DbOtpPurpose.REGISTER,
          input.preferredLanguage,
        );
        return {
          userId: existing.id,
          phone: input.phone,
          verificationRequired: true,
          expiresInSeconds: delivery.expiresInSeconds,
          purpose: toPurposeName(DbOtpPurpose.REGISTER),
          ...(meta.exposeDevOtp && delivery.devCode ? { devOtpCode: delivery.devCode } : {}),
        };
      }
      throw new ConflictError('An account already uses this phone number');
    }

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        preferredLanguage: input.preferredLanguage,
        status: DbAccountStatus.PENDING,
        roles: input.roles as DbUserRole[],
      },
    });

    await this.createProfilesForRoles(user.id, input.roles);

    const delivery = await this.otp.request(
      input.phone,
      DbOtpPurpose.REGISTER,
      input.preferredLanguage,
    );

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      after: { roles: input.roles, status: 'PENDING' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    this.logger.log(`Registered PENDING user ${user.id}`);

    return {
      userId: user.id,
      phone: input.phone,
      verificationRequired: true,
      expiresInSeconds: delivery.expiresInSeconds,
      purpose: toPurposeName(DbOtpPurpose.REGISTER),
      ...(meta.exposeDevOtp && delivery.devCode ? { devOtpCode: delivery.devCode } : {}),
    };
  }

  /**
   * Step one of sign-in: send a LOGIN code. Unknown numbers get a clear
   * message because a rider-app user who mistyped a digit needs to know, and
   * the endpoint is rate limited to blunt number enumeration. See
   * docs/SECURITY.md.
   */
  async sendLoginOtp(
    phone: string,
    meta: RequestMeta,
  ): Promise<{
    phone: string;
    purpose: OtpPurposeName;
    expiresInSeconds: number;
    devOtpCode?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, status: true, preferredLanguage: true, phoneVerifiedAt: true },
    });

    if (!user) {
      throw new NotFoundError('No account uses this phone number');
    }
    if (user.status === DbAccountStatus.SUSPENDED || user.status === DbAccountStatus.BLOCKED) {
      throw new AccountNotActiveError('This account is suspended. Contact support.');
    }
    if (user.status === DbAccountStatus.DELETED) {
      throw new NotFoundError('No account uses this phone number');
    }

    const purpose = user.phoneVerifiedAt ? DbOtpPurpose.LOGIN : DbOtpPurpose.REGISTER;

    const delivery = await this.otp.request(phone, purpose, user.preferredLanguage as Language);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.otp.sent',
      entityType: 'User',
      entityId: user.id,
      metadata: { purpose },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      phone,
      purpose: toPurposeName(purpose),
      expiresInSeconds: delivery.expiresInSeconds,
      ...(meta.exposeDevOtp && delivery.devCode ? { devOtpCode: delivery.devCode } : {}),
    };
  }

  /**
   * Completes registration or sign-in and opens a session.
   */
  async verifyOtp(
    input: {
      phone: string;
      code: string;
      purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET' | 'PHONE_CHANGE';
    },
    meta: RequestMeta,
  ): Promise<SessionOutcome> {
    const purpose = input.purpose as DbOtpPurpose;

    if (purpose === DbOtpPurpose.PASSWORD_RESET || purpose === DbOtpPurpose.PHONE_CHANGE) {
      throw new ValidationError(
        [
          {
            field: 'purpose',
            code: 'NOT_IMPLEMENTED',
            message: 'Password reset and phone change are scheduled with the staff-console epic',
          },
        ],
        'This flow is not available yet',
      );
    }

    const verified = await this.otp.verify(input.phone, purpose, input.code);

    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) throw new NotFoundError('No account uses this phone number');

    if (user.status === DbAccountStatus.SUSPENDED || user.status === DbAccountStatus.BLOCKED) {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.login.blocked',
        entityType: 'User',
        entityId: user.id,
        metadata: { status: user.status },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new AccountNotActiveError('This account is suspended. Contact support.');
    }

    const activated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: user.status === DbAccountStatus.PENDING ? DbAccountStatus.ACTIVE : user.status,
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
    });

    if (activated.status !== DbAccountStatus.ACTIVE) {
      throw new AccountNotActiveError('This account is not active');
    }

    const issued = await this.tokens.createSession(toSnapshot(activated), meta);
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: activated.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        roles: true,
        preferredLanguage: true,
        phoneVerifiedAt: true,
      },
    });

    await this.audit.record({
      actorId: activated.id,
      action: purpose === DbOtpPurpose.REGISTER ? 'auth.register.verified' : 'auth.login',
      entityType: 'Session',
      entityId: issued.sessionId,
      metadata: { otpChallengeId: verified.challengeId, purpose },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      session: {
        tokens: {
          accessToken: issued.accessToken,
          accessTokenExpiresInSeconds: issued.accessTokenExpiresInSeconds,
          refreshTokenExpiresInSeconds: issued.refreshTokenExpiresInSeconds,
        },
        user: toCurrentUserSummary(full),
      },
      refreshToken: issued.refreshToken,
      refreshTokenExpiresInSeconds: issued.refreshTokenExpiresInSeconds,
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<SessionOutcome> {
    const rotated = await this.tokens.rotateSession(refreshToken, meta);

    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotated.user.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        roles: true,
        preferredLanguage: true,
        phoneVerifiedAt: true,
      },
    });

    if (full.status !== DbAccountStatus.ACTIVE) {
      throw new AccountNotActiveError();
    }

    await this.audit.record({
      actorId: rotated.user.id,
      action: 'auth.token.refreshed',
      entityType: 'Session',
      entityId: rotated.sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      session: {
        tokens: {
          accessToken: rotated.accessToken,
          accessTokenExpiresInSeconds: rotated.accessTokenExpiresInSeconds,
          refreshTokenExpiresInSeconds: rotated.refreshTokenExpiresInSeconds,
        },
        user: toCurrentUserSummary(full),
      },
      refreshToken: rotated.refreshToken,
      refreshTokenExpiresInSeconds: rotated.refreshTokenExpiresInSeconds,
    };
  }

  async logout(
    userId: string | null,
    sessionId: string | null,
    meta: RequestMeta,
  ): Promise<{ revoked: boolean }> {
    if (userId && sessionId) {
      await this.tokens.revokeSession(sessionId, userId);
      await this.audit.record({
        actorId: userId,
        action: 'auth.logout',
        entityType: 'Session',
        entityId: sessionId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
    return { revoked: Boolean(userId && sessionId) };
  }

  /**
   * Logout when the access token already expired and only the refresh cookie
   * remains. Revokes the session that cookie belongs to.
   */
  async logoutByRefreshToken(refreshToken: string, meta: RequestMeta): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      select: { id: true, userId: true, status: true },
    });
    if (!session || session.status === DbSessionStatus.REVOKED) return false;

    await this.tokens.revokeSession(session.id, session.userId, 'LOGOUT');
    await this.audit.record({
      actorId: session.userId,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: session.id,
      metadata: { via: 'refresh_cookie' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return true;
  }

  async currentUser(userId: string): Promise<CurrentUserSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        roles: true,
        preferredLanguage: true,
        phoneVerifiedAt: true,
      },
    });
    return toCurrentUserSummary(user);
  }

  async updateProfile(
    userId: string,
    changes: { fullName?: string; email?: string | null; preferredLanguage?: Language },
    meta: RequestMeta,
  ): Promise<CurrentUserSummary> {
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true, email: true, preferredLanguage: true },
    });

    if (changes.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: changes.email, id: { not: userId } },
        select: { id: true },
      });
      if (clash) throw new ConflictError('That email address is already in use');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: changes.fullName,
        email: changes.email === undefined ? undefined : changes.email,
        preferredLanguage: changes.preferredLanguage,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        roles: true,
        preferredLanguage: true,
        phoneVerifiedAt: true,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'user.profile.updated',
      entityType: 'User',
      entityId: userId,
      before: { ...before },
      after: {
        fullName: updated.fullName,
        email: updated.email,
        preferredLanguage: updated.preferredLanguage,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return toCurrentUserSummary(updated);
  }

  private async createProfilesForRoles(userId: string, roles: string[]): Promise<void> {
    const wanted = roles.filter((role) =>
      (PROFILE_CREATING_ROLES as readonly string[]).includes(role),
    );
    if (wanted.includes('CUSTOMER')) {
      await this.prisma.customerProfile.create({ data: { userId } });
    }
    if (wanted.includes('RIDER')) {
      await this.prisma.riderProfile.create({ data: { userId } });
    }
    // MERCHANT, GARAGE, COOPERATIVE_MANAGER and BUSINESS_CLIENT keep their role
    // but need onboarding forms from their own epics before a profile exists.
  }
}
