import { describe, expect, it } from '@jest/globals';
import { normalizePhone, phoneSchema, registerSchema, verifyOtpSchema } from './index';

describe('normalizePhone: Rwandan formats', () => {
  const accepted: Array<[string, string]> = [
    ['0781234567', '+250781234567'],
    ['078 123 45 67', '+250781234567'],
    ['(078) 123-45-67', '+250781234567'],
    ['+250781234567', '+250781234567'],
    ['+250 781 23 45 67', '+250781234567'],
    ['250781234567', '+250781234567'],
    ['00250781234567', '+250781234567'],
    ['781234567', '+250781234567'],
  ];

  it.each(accepted)('normalises %s to %s', (input, expected) => {
    expect(normalizePhone(input)?.e164).toBe(expected);
    expect(normalizePhone(input)?.isRwandaMobile).toBe(true);
  });

  it('rejects non-Rwandan numbers rather than storing a guess', () => {
    expect(normalizePhone('+254712345678')).toBeNull();
    expect(normalizePhone('+14155552671')).toBeNull();
  });

  it('rejects malformed lengths and empty input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('07812345')).toBeNull();
    expect(normalizePhone('078123456789123456')).toBeNull();
  });

  it('keeps landline-shaped numbers but marks them as not mobile', () => {
    const result = normalizePhone('0681234567');
    expect(result?.e164).toBe('+250681234567');
    expect(result?.isRwandaMobile).toBe(false);
  });
});

describe('registerSchema', () => {
  it('defaults language to Kinyarwanda and role to CUSTOMER', () => {
    const parsed = registerSchema.parse({
      fullName: 'IRAGUHA Vincent',
      phone: '0781234567',
    });
    expect(parsed.preferredLanguage).toBe('rw');
    expect(parsed.roles).toEqual(['CUSTOMER']);
    expect(parsed.phone).toBe('+250781234567');
  });

  it('deduplicates requested roles', () => {
    const parsed = registerSchema.parse({
      fullName: 'IRAGUHA Vincent',
      phone: '+250781234567',
      roles: ['CUSTOMER', 'RIDER', 'CUSTOMER'],
    });
    expect(parsed.roles).toEqual(['CUSTOMER', 'RIDER']);
  });

  it('refuses self-assigned staff roles', () => {
    const result = registerSchema.safeParse({
      fullName: 'IRAGUHA Vincent',
      phone: '0781234567',
      roles: ['ADMIN'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('administrator');
    }
  });

  it('refuses names containing digits', () => {
    expect(registerSchema.safeParse({ fullName: 'VINCENT 078', phone: '0781234567' }).success).toBe(
      false,
    );
  });
});

describe('verifyOtpSchema', () => {
  it('accepts only a six digit code', () => {
    expect(verifyOtpSchema.safeParse({ phone: '0781234567', code: '123456' }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ phone: '0781234567', code: '12345' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ phone: '0781234567', code: '12 34 56' }).success).toBe(
      false,
    );
  });

  it('normalises the phone inside the schema', () => {
    const parsed = phoneSchema.parse('078 123 45 67');
    expect(parsed).toBe('+250781234567');
  });
});
