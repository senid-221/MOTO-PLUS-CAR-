import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing uses Node's built-in scrypt, so the deployment carries no
 * native module to rebuild. Stored format: scrypt$N$r$p$salt$hash.
 */
const SCRYPT = { N: 32768, r: 8, p: 1, keyLength: 64 };

export function hashPassword(password: string): string {
  if (password.length < 8) {
    throw new RangeError('Password must be at least 8 characters');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  }).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts as ['scrypt', string, string, string, string, string];
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * One-way hash for high-entropy secrets that are looked up by value
 * (refresh tokens). Deterministic so the row can be found by its hash alone.
 */
export function hashToken(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * OTP codes are short and guessable, so each challenge gets its own random
 * salt. Stored format: otp$<salt>$<hash>.
 */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(`${salt}:${code}`).digest('hex');
  return `otp$${salt}$${hash}`;
}

export function verifyOtpCode(code: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'otp') return false;
  const salt = parts[1] as string;
  const expected = Buffer.from(parts[2] as string, 'hex');
  const actual = createHash('sha256').update(`${salt}:${code}`).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Cryptographically random 6 digit code, never a timestamp or counter. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function randomId(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}
