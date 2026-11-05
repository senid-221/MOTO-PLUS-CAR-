import { AccountStatus, OtpPurpose, SessionStatus } from '@seremoto/prisma-client';
import { AuthService, type RequestMeta } from './auth.service';
import type { OtpService } from './otp.service';
import type { AuditService } from '../../common/security/audit.service';
import type { PrismaService } from '../../common/database/prisma.service';
import type { TokenService } from './token.service';
import {
  AccountNotActiveError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/http/api-error';

const PHONE = '+250788123456';
const META: RequestMeta = { exposeDevOtp: true, ipAddress: '41.74.10.5', userAgent: 'Next.js' };

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Uwimana Eric',
    phone: PHONE,
    email: null,
    status: AccountStatus.ACTIVE,
    roles: ['CUSTOMER'],
    preferredLanguage: 'rw',
    phoneVerifiedAt: new Date('2026-01-04T10:00:00.000Z'),
    ...overrides,
  };
}

function build(options: { existing?: ReturnType<typeof userRow> | null } = {}) {
  const account = options.existing === undefined ? userRow() : options.existing;

  const user = {
    findUnique: jest.fn(async () => account),
    findUniqueOrThrow: jest.fn(async () => account ?? userRow()),
    findFirst: jest.fn(async () => null as { id: string } | null),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
      userRow({ id: 'user-new', ...data }),
    ),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
      userRow({ ...data, roles: data.roles ?? ['CUSTOMER'] }),
    ),
  };
  const customerProfile = { create: jest.fn(async () => ({ id: 'profile-1' })) };
  const riderProfile = { create: jest.fn(async () => ({ id: 'rider-1' })) };
  interface SessionLookup {
    id: string;
    userId: string;
    status: string;
  }
  const session = { findUnique: jest.fn(async () => null as SessionLookup | null) };

  const prisma = { user, customerProfile, riderProfile, session };

  const otp = {
    request: jest.fn(async () => ({
      expiresInSeconds: 300,
      providerReference: 'log-1',
      devCode: '246813',
    })),
    verify: jest.fn(async () => ({
      phone: PHONE,
      purpose: OtpPurpose.LOGIN,
      challengeId: 'challenge-9',
    })),
  };

  const tokens = {
    createSession: jest.fn(async () => ({
      sessionId: 'session-1',
      accessToken: 'access.jwt',
      refreshToken: 'refresh-raw',
      accessTokenExpiresInSeconds: 900,
      refreshTokenExpiresInSeconds: 2_592_000,
    })),
    rotateSession: jest.fn(async () => ({
      sessionId: 'session-2',
      accessToken: 'access-2.jwt',
      refreshToken: 'refresh-raw-2',
      accessTokenExpiresInSeconds: 900,
      refreshTokenExpiresInSeconds: 2_592_000,
      user: {
        id: 'user-1',
        fullName: 'Uwimana Eric',
        phone: PHONE,
        preferredLanguage: 'rw',
        roles: ['CUSTOMER'],
      },
    })),
    revokeSession: jest.fn(async () => undefined),
  };

  const audit = {
    record: jest.fn(async () => undefined),
    recordStrict: jest.fn(async () => undefined),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    otp as unknown as OtpService,
    tokens as unknown as TokenService,
    audit as unknown as AuditService,
  );

  return { service, prisma, user, customerProfile, riderProfile, session, otp, tokens, audit };
}

const registerInput = {
  fullName: 'Uwimana Eric',
  phone: PHONE,
  preferredLanguage: 'rw' as const,
  roles: ['CUSTOMER'],
};

describe('AuthService.register', () => {
  it('creates a PENDING account and asks for phone verification', async () => {
    const { service, user, otp, audit } = build({ existing: null });
    const result = await service.register(registerInput, META);

    const created = user.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.status).toBe(AccountStatus.PENDING);
    expect(result).toMatchObject({
      userId: 'user-new',
      verificationRequired: true,
      expiresInSeconds: 300,
      purpose: OtpPurpose.REGISTER,
      devOtpCode: '246813',
    });
    expect(otp.request).toHaveBeenCalledWith(PHONE, OtpPurpose.REGISTER, 'rw');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.register' }));
  });

  it('lets an unfinished registration continue instead of dead-ending the user', async () => {
    const { service, user } = build({
      existing: userRow({ id: 'user-pending', status: AccountStatus.PENDING }),
    });
    const result = await service.register(registerInput, META);

    expect(user.create).not.toHaveBeenCalled();
    expect(result.userId).toBe('user-pending');
  });

  it('refuses to create a second account for an active phone number', async () => {
    const { service } = build({ existing: userRow({ status: AccountStatus.ACTIVE }) });
    await expect(service.register(registerInput, META)).rejects.toBeInstanceOf(ConflictError);
  });

  it('only creates profiles for roles that have an onboarding form', async () => {
    const { service, customerProfile, riderProfile } = build({ existing: null });
    await service.register({ ...registerInput, roles: ['CUSTOMER', 'RIDER'] }, META);
    expect(customerProfile.create).toHaveBeenCalledTimes(1);
    expect(riderProfile.create).toHaveBeenCalledTimes(1);

    const merchant = build({ existing: null });
    await merchant.service.register({ ...registerInput, roles: ['MERCHANT'] }, META);
    expect(merchant.customerProfile.create).not.toHaveBeenCalled();
    expect(merchant.riderProfile.create).not.toHaveBeenCalled();
  });

  it('withholds the code when the caller is not a development client', async () => {
    const { service } = build({ existing: null });
    const result = await service.register(registerInput, { ...META, exposeDevOtp: false });
    expect(result.devOtpCode).toBeUndefined();
  });
});

describe('AuthService.sendLoginOtp', () => {
  it('says plainly when no account uses the number', async () => {
    const { service } = build({ existing: null });
    await expect(service.sendLoginOtp(PHONE, META)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('will not send a login code to a suspended account', async () => {
    const { service, otp } = build({ existing: userRow({ status: AccountStatus.SUSPENDED }) });
    await expect(service.sendLoginOtp(PHONE, META)).rejects.toBeInstanceOf(AccountNotActiveError);
    expect(otp.request).not.toHaveBeenCalled();
  });

  it('sends a REGISTER code when the phone was never verified', async () => {
    const { service, otp } = build({
      existing: userRow({ status: AccountStatus.PENDING, phoneVerifiedAt: null }),
    });
    const result = await service.sendLoginOtp(PHONE, META);
    expect(otp.request).toHaveBeenCalledWith(PHONE, OtpPurpose.REGISTER, 'rw');
    // The confirm step has to be told: guessing LOGIN here would reject a valid code.
    expect(result.purpose).toBe(OtpPurpose.REGISTER);
  });

  it('tells the client which purpose an already-verified number got', async () => {
    const { service, otp } = build();
    const result = await service.sendLoginOtp(PHONE, META);
    expect(otp.request).toHaveBeenCalledWith(PHONE, OtpPurpose.LOGIN, 'rw');
    expect(result).toMatchObject({
      phone: PHONE,
      purpose: OtpPurpose.LOGIN,
      expiresInSeconds: 300,
    });
  });

  it('audits every code it sends', async () => {
    const { service, audit } = build();
    await service.sendLoginOtp(PHONE, META);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.otp.sent', metadata: { purpose: OtpPurpose.LOGIN } }),
    );
  });
});

describe('AuthService.verifyOtp', () => {
  it('does not pretend password reset works', async () => {
    const { service, otp } = build();
    await expect(
      service.verifyOtp({ phone: PHONE, code: '123456', purpose: 'PASSWORD_RESET' }, META),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(otp.verify).not.toHaveBeenCalled();
  });

  it('activates a pending account and opens a session', async () => {
    const { service, user, tokens } = build({
      existing: userRow({ status: AccountStatus.PENDING, phoneVerifiedAt: null }),
    });
    const outcome = await service.verifyOtp(
      { phone: PHONE, code: '246813', purpose: 'REGISTER' },
      META,
    );

    const update = user.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data.status).toBe(AccountStatus.ACTIVE);
    expect(update.data.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(tokens.createSession).toHaveBeenCalled();
    expect(outcome.refreshToken).toBe('refresh-raw');
    expect(outcome.session.user.permissions).toContain('account:update');
  });

  it('links the audit trail to the OTP challenge that was used', async () => {
    const { service, audit } = build();
    await service.verifyOtp({ phone: PHONE, code: '246813', purpose: 'LOGIN' }, META);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login',
        metadata: { otpChallengeId: 'challenge-9', purpose: OtpPurpose.LOGIN },
      }),
    );
  });

  it('records a blocked login for a suspended account', async () => {
    const { service, audit, tokens } = build({
      existing: userRow({ status: AccountStatus.SUSPENDED }),
    });
    await expect(
      service.verifyOtp({ phone: PHONE, code: '246813', purpose: 'LOGIN' }, META),
    ).rejects.toBeInstanceOf(AccountNotActiveError);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.blocked' }),
    );
    expect(tokens.createSession).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('returns a fresh session for the current role set', async () => {
    const { service, tokens, audit } = build();
    const outcome = await service.refresh('refresh-raw', META);
    expect(tokens.rotateSession).toHaveBeenCalledWith('refresh-raw', META);
    expect(outcome.session.tokens.accessToken).toBe('access-2.jwt');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.token.refreshed' }),
    );
  });

  it('refuses to keep a suspended account authenticated', async () => {
    const { service } = build({ existing: userRow({ status: AccountStatus.SUSPENDED }) });
    await expect(service.refresh('refresh-raw', META)).rejects.toBeInstanceOf(
      AccountNotActiveError,
    );
  });
});

describe('AuthService.logoutByRefreshToken', () => {
  it('reports nothing to revoke for an unknown or already revoked cookie', async () => {
    const { service, tokens } = build();
    await expect(service.logoutByRefreshToken('unknown', META)).resolves.toBe(false);
    expect(tokens.revokeSession).not.toHaveBeenCalled();

    const active = build();
    active.session.findUnique.mockResolvedValue({
      id: 'session-9',
      userId: 'user-1',
      status: SessionStatus.REVOKED,
    });
    await expect(active.service.logoutByRefreshToken('used', META)).resolves.toBe(false);
  });

  it('revokes the session behind a live refresh cookie', async () => {
    const { service, session, tokens, audit } = build();
    session.findUnique.mockResolvedValue({
      id: 'session-9',
      userId: 'user-1',
      status: SessionStatus.ACTIVE,
    });
    await expect(service.logoutByRefreshToken('live', META)).resolves.toBe(true);
    expect(tokens.revokeSession).toHaveBeenCalledWith('session-9', 'user-1', 'LOGOUT');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', metadata: { via: 'refresh_cookie' } }),
    );
  });

  it('does not claim a logout when there is no session to end', async () => {
    const { service } = build();
    await expect(service.logout(null, null, META)).resolves.toEqual({ revoked: false });
  });
});

describe('AuthService.updateProfile', () => {
  it('refuses an email already used by another account', async () => {
    const { service, user } = build();
    user.findFirst.mockResolvedValue({ id: 'user-2' });
    await expect(
      service.updateProfile('user-1', { email: 'taken@seremoto.rw' }, META),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('audits the values before and after the change', async () => {
    const { service, audit } = build();
    await service.updateProfile('user-1', { preferredLanguage: 'en' }, META);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.profile.updated',
        before: expect.objectContaining({ preferredLanguage: 'rw' }),
        after: expect.objectContaining({ preferredLanguage: 'en' }),
      }),
    );
  });
});
