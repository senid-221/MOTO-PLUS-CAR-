import { exposesDevOtp, parseEnvironment } from './environment';

const SECRET_A = 'access-secret-value-that-is-long-enough-32';
const SECRET_B = 'refresh-secret-value-that-is-long-enough-32';

function baseEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/seremoto?schema=public',
    JWT_ACCESS_SECRET: SECRET_A,
    JWT_REFRESH_SECRET: SECRET_B,
    ...overrides,
  };
}

describe('environment contract', () => {
  it('applies the documented defaults for a development boot', () => {
    const env = parseEnvironment(baseEnv({ NODE_ENV: 'development' }));
    expect(env.API_PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL).toBe(900);
    expect(env.REFRESH_TOKEN_TTL).toBe(60 * 60 * 24 * 30);
    expect(env.OTP_TTL_SECONDS).toBe(300);
    expect(env.OTP_MAX_ATTEMPTS).toBe(5);
    expect(env.SMS_PROVIDER).toBe('log');
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('splits the CORS allowlist and drops blanks', () => {
    const env = parseEnvironment(
      baseEnv({ CORS_ALLOWED_ORIGINS: 'https://seremoto.rw, https://admin.seremoto.rw,,' }),
    );
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['https://seremoto.rw', 'https://admin.seremoto.rw']);
  });

  it('refuses to boot without a database', () => {
    const { DATABASE_URL: _drop, ...rest } = baseEnv();
    expect(() => parseEnvironment(rest)).toThrow(/DATABASE_URL/);
  });

  it('refuses a short JWT secret', () => {
    expect(() => parseEnvironment(baseEnv({ JWT_ACCESS_SECRET: 'tiny' }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('refuses identical access and refresh secrets', () => {
    expect(() => parseEnvironment(baseEnv({ JWT_REFRESH_SECRET: SECRET_A }))).toThrow(
      /must differ/,
    );
  });

  it('refuses the log SMS stand-in in production, where it would silently drop OTPs', () => {
    expect(() => parseEnvironment(baseEnv({ NODE_ENV: 'production' }))).toThrow(/SMS_PROVIDER/);
    expect(() =>
      parseEnvironment(baseEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'mtn' })),
    ).not.toThrow();
  });

  it('rejects out-of-range token lifetimes', () => {
    expect(() => parseEnvironment(baseEnv({ ACCESS_TOKEN_TTL: '5' }))).toThrow();
    expect(() => parseEnvironment(baseEnv({ REFRESH_TOKEN_TTL: '60' }))).toThrow();
  });

  it('only echoes a dev OTP outside production and only for the log provider', () => {
    expect(exposesDevOtp(parseEnvironment(baseEnv({ NODE_ENV: 'development' })))).toBe(true);
    expect(
      exposesDevOtp(parseEnvironment(baseEnv({ NODE_ENV: 'development', SMS_PROVIDER: 'mtn' }))),
    ).toBe(false);
  });
});
