import { z } from 'zod';

/**
 * Environment contract. The API refuses to start when a value is missing or
 * malformed, so a misconfigured deployment fails loudly at boot instead of
 * producing half-working authentication at runtime.
 */
export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL: z.coerce
      .number()
      .int()
      .min(3600)
      .max(60 * 60 * 24 * 180)
      .default(60 * 60 * 24 * 30),

    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    SMS_PROVIDER: z.enum(['log', 'mtn', 'twilio']).default('log'),

    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
    APP_WEB_URL: z.string().url().default('http://localhost:3000'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.SMS_PROVIDER === 'log') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER=log cannot be used in production: OTP codes would never be sent',
      });
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'Access and refresh secrets must differ',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed.data;
}

/** True when the OTP code may be echoed back to the caller for local testing. */
export function exposesDevOtp(env: Environment): boolean {
  return env.NODE_ENV !== 'production' && env.SMS_PROVIDER === 'log';
}

export const isTestEnvironment = (env: Environment): boolean => env.NODE_ENV === 'test';
export const isProductionLike = (env: Environment): boolean =>
  env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
