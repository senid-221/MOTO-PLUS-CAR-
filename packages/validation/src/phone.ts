import { z } from 'zod';

/**
 * Phone numbers are stored in E.164 international format.
 *
 * Rwanda country code is 250. Mobile numbers are 9 digits and start with 7
 * (for example 781 23 45 67); they are dialled locally as 0 781 23 45 67.
 * Only Rwandan numbers are accepted for the launch market; anything else
 * normalizes to null rather than being stored in a half-understood form.
 */
export const RWANDA_COUNTRY_CODE = '250';

const RWANDA_MOBILE_NATIONAL = /^7\d{8}$/;

export interface NormalizedPhone {
  /** E.164 value, for example +250781234567. */
  e164: string;
  /** 9-digit national significant number without the trunk prefix. */
  national: string;
  /** True when the national number is a plausible Rwandan mobile line. */
  isRwandaMobile: boolean;
}

/**
 * Strip separators and any trunk or country prefix, then normalise to E.164.
 * Returns null when the input cannot be a Rwandan number.
 */
export function normalizePhone(
  raw: string,
  defaultCountryCode: string = RWANDA_COUNTRY_CODE,
): NormalizedPhone | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 9 || digits.length > 15) return null;

  const writtenInternationally = trimmed.startsWith('+') || trimmed.startsWith('00');
  let national: string;

  if (writtenInternationally) {
    const withoutExitCode = trimmed.startsWith('00') ? digits.slice(2) : digits;
    if (!withoutExitCode.startsWith(defaultCountryCode)) return null;
    national = withoutExitCode.slice(defaultCountryCode.length);
  } else if (digits.startsWith(defaultCountryCode) && digits.length > 9) {
    national = digits.slice(defaultCountryCode.length);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (national.length !== 9) return null;

  return {
    e164: `+${defaultCountryCode}${national}`,
    national,
    isRwandaMobile: RWANDA_MOBILE_NATIONAL.test(national),
  };
}

/** Zod refinement used by every endpoint that accepts a phone number. */
export const phoneSchema = z
  .string()
  .min(7, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid Rwandan phone number, for example 0781234567',
      });
      return z.NEVER;
    }
    return normalized.e164;
  });

/** Phone that must additionally be a Rwandan mobile line. */
export const rwandaMobileSchema = phoneSchema.refine(
  (value) => normalizePhone(value)?.isRwandaMobile === true,
  { message: 'Only Rwandan mobile numbers are accepted' },
);

export const languageSchema = z.enum(['rw', 'en']);
