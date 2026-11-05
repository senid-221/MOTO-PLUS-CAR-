import {
  generateOtpCode,
  hashOtpCode,
  hashPassword,
  hashToken,
  randomId,
  verifyOtpCode,
  verifyPassword,
} from './hashing';

describe('password hashing', () => {
  it('verifies the password that was hashed', () => {
    const stored = hashPassword('Nibyera2026!');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('Nibyera2026!', stored)).toBe(true);
  });

  it('rejects a different password', () => {
    const stored = hashPassword('Nibyera2026!');
    expect(verifyPassword('nibyera2026!', stored)).toBe(false);
  });

  it('never stores the same hash twice for the same password', () => {
    expect(hashPassword('Nibyera2026!')).not.toEqual(hashPassword('Nibyera2026!'));
  });

  it('refuses a short password instead of storing a weak one', () => {
    expect(() => hashPassword('short')).toThrow(RangeError);
  });

  it('returns false for missing or malformed stored values', () => {
    expect(verifyPassword('whatever', null)).toBe(false);
    expect(verifyPassword('whatever', 'plaintext-hash')).toBe(false);
    expect(verifyPassword('whatever', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('refresh token hashing', () => {
  it('is deterministic so a row can be found by its hash', () => {
    const secret = randomId();
    expect(hashToken(secret)).toEqual(hashToken(secret));
    expect(hashToken(secret)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not collide visibly for nearby secrets', () => {
    expect(hashToken('a')).not.toEqual(hashToken('b'));
  });
});

describe('OTP code handling', () => {
  it('generates a 6-digit code, never an empty or short one', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) codes.add(generateOtpCode());
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(150);
  });

  it('verifies a code against its own salted hash', () => {
    const code = '481920';
    const stored = hashOtpCode(code);
    expect(stored.startsWith('otp$')).toBe(true);
    expect(stored).not.toContain(code);
    expect(verifyOtpCode(code, stored)).toBe(true);
    expect(verifyOtpCode('481921', stored)).toBe(false);
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyOtpCode('123456', '123456')).toBe(false);
    expect(verifyOtpCode('123456', 'sha$abc')).toBe(false);
  });
});

describe('randomId', () => {
  it('is url-safe and long enough to be unguessable', () => {
    const value = randomId(48);
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(value.length).toBeGreaterThan(40);
    expect(new Set([randomId(), randomId()]).size).toBe(2);
  });
});
