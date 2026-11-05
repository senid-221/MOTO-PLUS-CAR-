import { Inject, Injectable, Logger } from '@nestjs/common';
import { type OtpPurpose } from '@seremoto/prisma-client';
import { PrismaService } from '../../common/database/prisma.service';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../../common/security/hashing';
import {
  InvalidOtpError,
  OtpAttemptLimitError,
  OtpExpiredError,
  RateLimitedError,
} from '../../common/http/api-error';
import type { Environment } from '../../config/environment';
import { ENV_TOKEN } from '../../config/env.module';
import { t, type TranslationKey } from '@seremoto/localization';
import type { Language } from '@seremoto/shared-types';
import { SmsProviderRegistry } from './sms/sms.provider';

const MAX_SENDS_PER_HOUR = 5;

export interface OtpDelivery {
  expiresInSeconds: number;
  devCode?: string;
  providerReference: string | null;
}

export interface VerifiedOtp {
  phone: string;
  purpose: OtpPurpose;
  challengeId: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger('OtpService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsProviderRegistry,
    @Inject(ENV_TOKEN)
    private readonly env: Environment,
  ) {}

  /**
   * Issues a fresh code. Any previous code for the same phone and purpose is
   * invalidated first, so only one challenge can ever be live at a time.
   */
  async request(
    phone: string,
    purpose: OtpPurpose,
    language: Language,
    resend = false,
  ): Promise<OtpDelivery> {
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.otpChallenge.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recentCount >= MAX_SENDS_PER_HOUR) {
      throw new RateLimitedError('Too many codes requested for this number. Try again later.');
    }

    const code = generateOtpCode();
    const expiresInSeconds = this.env.OTP_TTL_SECONDS;

    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.updateMany({
        where: { phone, purpose, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
      return tx.otpChallenge.create({
        data: {
          phone,
          purpose,
          codeHash: hashOtpCode(code),
          maxAttempts: this.env.OTP_MAX_ATTEMPTS,
          deliveryChannel: this.env.SMS_PROVIDER,
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        },
      });
    });

    const messageKey: TranslationKey = resend ? 'sms.otp.resend_body' : 'sms.otp.body';
    const body = t(language, messageKey, {
      code,
      minutes: Math.round(expiresInSeconds / 60),
    });

    const provider = this.sms.resolve(this.env.SMS_PROVIDER);
    const dispatch = await provider.send(phone, body).catch((error: Error) => {
      this.logger.error(`OTP delivery failed for ${phone}: ${error.message}`);
      throw error;
    });

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { deliveryReference: dispatch.providerReference },
    });

    return {
      expiresInSeconds,
      providerReference: dispatch.providerReference,
      ...(this.env.NODE_ENV !== 'production' && this.env.SMS_PROVIDER === 'log'
        ? { devCode: code }
        : {}),
    };
  }

  /**
   * Checks a submitted code. Wrong, expired and exhausted codes all consume
   * the challenge so a brute-force attempt cannot reuse it.
   */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<VerifiedOtp> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null, invalidatedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new InvalidOtpError('No pending code. Request a new one.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { invalidatedAt: new Date() },
      });
      throw new OtpExpiredError();
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { invalidatedAt: new Date() },
      });
      throw new OtpAttemptLimitError();
    }

    const matches = verifyOtpCode(code, challenge.codeHash);

    if (!matches) {
      const updated = await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= updated.maxAttempts) {
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { invalidatedAt: new Date() },
        });
        throw new OtpAttemptLimitError();
      }
      throw new InvalidOtpError();
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return { phone, purpose, challengeId: challenge.id };
  }
}
