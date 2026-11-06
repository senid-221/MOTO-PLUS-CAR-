import { OtpPurpose } from '@seremoto/prisma-client';
import { OtpService } from './otp.service';
import { SmsProviderRegistry, type SmsProvider } from './sms/sms.provider';
import { hashOtpCode } from '../../common/security/hashing';
import {
  InvalidOtpError,
  OtpAttemptLimitError,
  OtpExpiredError,
  RateLimitedError,
} from '../../common/http/api-error';
import type { Environment } from '../../config/environment';
import type { PrismaService } from '../../common/database/prisma.service';

const PHONE = '+250788123456';

interface ChallengeRow {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}

function otpEnv(overrides: Partial<Environment> = {}): Environment {
  return {
    NODE_ENV: 'test',
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 5,
    SMS_PROVIDER: 'log',
    ...overrides,
  } as unknown as Environment;
}

function build(
  options: {
    sendsInWindow?: number;
    challenge?: Partial<ChallengeRow> | null;
    provider?: SmsProvider;
    env?: Environment;
  } = {},
) {
  const rows: ChallengeRow[] = [];
  const provider = options.provider ?? {
    name: 'log',
    send: jest.fn(async () => ({ providerReference: 'log-1', channel: 'sms' as const })),
  };

  const challenge = (overrides: Partial<ChallengeRow> = {}): ChallengeRow => ({
    id: 'challenge-1',
    phone: PHONE,
    purpose: OtpPurpose.LOGIN,
    codeHash: hashOtpCode('123456'),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 300_000),
    consumedAt: null,
    invalidatedAt: null,
    ...overrides,
  });

  const stored = options.challenge === null ? null : challenge({ ...(options.challenge ?? {}) });

  const otpChallenge = {
    count: jest.fn(async () => options.sendsInWindow ?? 0),
    updateMany: jest.fn(async () => ({ count: 0 })),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = challenge(data as Partial<ChallengeRow>);
      rows.push(row);
      return { ...row, ...data };
    }),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const base = rows.find((row) => row.id === where.id) ?? stored ?? challenge();
        const next: ChallengeRow = {
          ...base,
          attempts:
            typeof data.attempts === 'number'
              ? data.attempts
              : base.attempts + ((data.attempts as { increment?: number })?.increment ?? 0),
          consumedAt: (data.consumedAt as Date | undefined) ?? base.consumedAt,
          invalidatedAt: (data.invalidatedAt as Date | undefined) ?? base.invalidatedAt,
        };
        const index = rows.findIndex((row) => row.id === where.id);
        if (index >= 0) rows[index] = next;
        else rows.push(next);
        return next;
      },
    ),
    findFirst: jest.fn(async () => stored),
  };

  const prisma = {
    otpChallenge,
    // Both transaction shapes are accepted: the interactive callback form and
    // the statement-array form that OtpService issues against a hosted database.
    $transaction: jest.fn(async (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
      typeof arg === 'function' ? arg({ otpChallenge }) : Promise.all(arg),
    ),
  };

  const service = new OtpService(
    prisma as unknown as PrismaService,
    new SmsProviderRegistry([provider]),
    options.env ?? otpEnv(),
  );

  return { service, prisma, otpChallenge, provider, rows };
}

describe('OtpService.request', () => {
  it('stops the fifth send inside an hour for one number', async () => {
    const { service, otpChallenge } = build({ sendsInWindow: 5 });
    await expect(service.request(PHONE, OtpPurpose.LOGIN, 'rw')).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(otpChallenge.create).not.toHaveBeenCalled();
  });

  it('stores a salted hash instead of the code and returns the code only to the log stand-in', async () => {
    const { service, otpChallenge } = build();
    const delivery = await service.request(PHONE, OtpPurpose.REGISTER, 'rw');

    expect(delivery.devCode).toMatch(/^\d{6}$/);
    const created = otpChallenge.create.mock.calls[0]?.[0] as {
      data: { codeHash: string; deliveryChannel: string; maxAttempts: number };
    };
    expect(created.data.codeHash.startsWith('otp$')).toBe(true);
    expect(created.data.codeHash).not.toContain(String(delivery.devCode));
    expect(created.data.maxAttempts).toBe(5);
    expect(delivery.providerReference).toBe('log-1');
  });

  it('never hands the code back when a real provider is configured', async () => {
    const { service } = build({
      env: otpEnv({ SMS_PROVIDER: 'mtn' }),
      provider: {
        name: 'mtn',
        send: jest.fn(async () => ({ providerReference: 'mtn-1', channel: 'sms' as const })),
      },
    });
    const delivery = await service.request(PHONE, OtpPurpose.LOGIN, 'en');
    expect(delivery.devCode).toBeUndefined();
    expect(delivery.providerReference).toBe('mtn-1');
  });

  it('refuses an unconfigured provider instead of dropping the message', async () => {
    const { service } = build({ env: otpEnv({ SMS_PROVIDER: 'twilio' }) });
    await expect(service.request(PHONE, OtpPurpose.LOGIN, 'en')).rejects.toThrow(
      /not implemented yet/,
    );
  });

  it('invalidates the previous live challenge before issuing a new one', async () => {
    const { service, otpChallenge } = build();
    await service.request(PHONE, OtpPurpose.LOGIN, 'rw');
    expect(otpChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone: PHONE, consumedAt: null, invalidatedAt: null }),
      }),
    );
  });
});

describe('OtpService.verify', () => {
  it('accepts the live code and consumes the challenge', async () => {
    const { service, otpChallenge } = build({ challenge: { codeHash: hashOtpCode('246813') } });
    const verified = await service.verify(PHONE, OtpPurpose.LOGIN, '246813');
    expect(verified.challengeId).toBe('challenge-1');
    expect(otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
    );
  });

  it('rejects when there is no pending challenge', async () => {
    const { service } = build({ challenge: null });
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '123456')).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });

  it('rejects an expired code and marks the challenge invalid', async () => {
    const { service, otpChallenge } = build({
      challenge: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '123456')).rejects.toBeInstanceOf(
      OtpExpiredError,
    );
    expect(otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects once the attempt ceiling is reached', async () => {
    const { service } = build({ challenge: { attempts: 5 } });
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '123456')).rejects.toBeInstanceOf(
      OtpAttemptLimitError,
    );
  });

  it('counts a wrong guess and burns the challenge on the last allowed try', async () => {
    const { service } = build({ challenge: { attempts: 4, maxAttempts: 5 } });
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '000000')).rejects.toBeInstanceOf(
      OtpAttemptLimitError,
    );
  });

  it('reports a plain mismatch while attempts remain', async () => {
    const { service, otpChallenge } = build({ challenge: { attempts: 0 } });
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '000000')).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
    expect(otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: { increment: 1 } }) }),
    );
  });

  it('cannot be replayed after the code was consumed', async () => {
    const { service, otpChallenge } = build({ challenge: { consumedAt: new Date() } });
    otpChallenge.findFirst.mockResolvedValue(null);
    await expect(service.verify(PHONE, OtpPurpose.LOGIN, '123456')).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });
});
