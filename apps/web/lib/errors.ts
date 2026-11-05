/**
 * Turning failures into something a user can read, in their own language.
 *
 * The API's own error messages are English and written for developers, so the
 * interface never prints them. The machine-readable `code` decides which
 * dictionary key is shown instead. Server-supplied field names pick the field
 * message when a form fails validation.
 */
import type { ZodError } from '@seremoto/validation';
import type { ErrorCode } from '@seremoto/shared-types';
import { ApiFailure } from './api';
import type { Translate, TranslationKey } from '@/messages';

const CODE_KEYS: Partial<Record<ErrorCode, TranslationKey>> = {
  INVALID_OTP: 'error.otp_mismatch',
  OTP_EXPIRED: 'error.otp_expired',
  OTP_TOO_MANY_ATTEMPTS: 'error.otp_attempts',
  RATE_LIMITED: 'error.rate_limited',
  ACCOUNT_NOT_ACTIVE: 'error.account_suspended',
  FORBIDDEN: 'error.forbidden',
  UNAUTHENTICATED: 'auth.session.expired',
  TOKEN_EXPIRED: 'auth.session.expired',
  TOKEN_INVALID: 'auth.session.expired',
  CONFLICT: 'error.phone_taken',
  VALIDATION_ERROR: 'error.required',
  NOT_FOUND: 'state.error.title',
};

/** Field-level copy for the shared zod schemas, keyed by the schema property. */
const FIELD_KEYS: Record<string, TranslationKey> = {
  fullName: 'error.invalid_name',
  phone: 'error.invalid_phone',
  code: 'error.invalid_code',
  email: 'error.invalid_email',
  roles: 'error.required',
};

export function messageForCode(code: ErrorCode, t: Translate): string {
  return t(CODE_KEYS[code] ?? 'error.unknown');
}

/**
 * Localised text for anything a form can catch: a zod rejection, an API
 * failure, or a fetch that never got a response.
 */
export function describeFailure(error: unknown, t: Translate): string {
  if (error instanceof ApiFailure) {
    if (error.unreachable) return t('error.network');
    if (error.code === 'VALIDATION_ERROR') {
      const field = error.details.find((detail) => detail.field)?.field;
      const key = field ? FIELD_KEYS[field] : undefined;
      return key ? t(key) : t('error.required');
    }
    return messageForCode(error.code, t);
  }

  if (error instanceof TypeError) return t('error.network');

  return t('error.unknown');
}

/** First problem with a client-side schema, attributed to its field. */
export function describeZodError(error: ZodError, t: Translate): string {
  const issue = error.issues[0];
  if (!issue) return t('error.unknown');
  const field = issue.path[0];
  const key = typeof field === 'string' ? FIELD_KEYS[field] : undefined;
  if (key) return t(key);
  if (
    issue.code === 'custom' &&
    typeof issue.message === 'string' &&
    issue.message.includes('role')
  ) {
    return t('error.forbidden');
  }
  return t('error.required');
}

/** Field-by-field messages, used to mark inputs as invalid. */
export function fieldErrors(error: unknown, t: Translate): Record<string, string> {
  const out: Record<string, string> = {};

  const add = (field: unknown): void => {
    if (typeof field !== 'string') return;
    const key = FIELD_KEYS[field];
    if (key && !out[field]) out[field] = t(key);
  };

  if (error instanceof ApiFailure) {
    error.details.forEach((detail) => add(detail.field));
    return out;
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    (error as ZodError).issues.forEach((issue) => add(issue.path[0]));
  }
  return out;
}
