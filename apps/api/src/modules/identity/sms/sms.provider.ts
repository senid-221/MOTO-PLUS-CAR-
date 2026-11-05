import { Injectable, Logger } from '@nestjs/common';

export interface SmsDispatchResult {
  providerReference: string;
  channel: 'sms';
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsDispatchResult>;
}

/**
 * Development stand-in. It records the message and returns a reference, but it
 * does not contact any carrier, so an OTP can never actually reach a phone.
 * Selected only when SMS_PROVIDER=log, which the environment contract forbids
 * in production and staging.
 */
@Injectable()
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  private readonly logger = new Logger('LogSmsProvider');
  private sequence = 0;

  async send(to: string, body: string): Promise<SmsDispatchResult> {
    this.sequence += 1;
    const reference = `log-${Date.now()}-${this.sequence}`;
    this.logger.warn(
      `[DEV ONLY] SMS to ${to} was not sent. Message: "${body}" (reference ${reference})`,
    );
    return { providerReference: reference, channel: 'sms' };
  }
}

/**
 * Adapter chosen from the environment. A real carrier adapter belongs to its
 * own epic; naming an unconfigured provider fails at boot rather than
 * silently dropping the message a user is waiting for.
 */
@Injectable()
export class SmsProviderRegistry {
  constructor(private readonly providers: SmsProvider[]) {}

  resolve(name: string): SmsProvider {
    const provider = this.providers.find((candidate) => candidate.name === name);
    if (!provider) {
      throw new Error(
        `SMS provider "${name}" is not implemented yet. Available: ${this.providers
          .map((candidate) => candidate.name)
          .join(', ')}`,
      );
    }
    return provider;
  }
}
