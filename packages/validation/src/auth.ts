import { z } from 'zod';
import { SELF_ASSIGNABLE_ROLES, USER_ROLES, type UserRole } from '@seremoto/shared-types';
import { languageSchema, phoneSchema } from './phone';

const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'Enter your full name')
  .max(120, 'Full name is too long')
  .regex(/^[^\d]*$/, 'Full name must not contain numbers');

const optionalEmailSchema = z
  .union([z.literal(''), z.string().trim().email('Email address is not valid').max(160)])
  .transform((value) => (value.length === 0 ? null : value));

/** Roles a user may request during self-registration; staff roles are excluded. */
const userRoleSchema = z
  .string()
  .refine((value): value is UserRole => (USER_ROLES as readonly string[]).includes(value), {
    message: 'Unknown role',
  });

const selfAssignableRolesSchema = z
  .array(userRoleSchema)
  .min(1, 'Select at least one role')
  .max(4, 'Too many roles requested at once')
  .transform((roles) => Array.from(new Set(roles)))
  .superRefine((roles, ctx) => {
    roles.forEach((role) => {
      if (!SELF_ASSIGNABLE_ROLES.includes(role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Role ${role} must be granted by an administrator`,
          path: ['roles'],
        });
      }
    });
  });

export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  preferredLanguage: languageSchema.default('rw'),
  roles: selfAssignableRolesSchema.default(['CUSTOMER']),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const sendOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_CHANGE']).default('LOGIN'),
});
export type SendOtpDto = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
  purpose: z.enum(['REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_CHANGE']).default('LOGIN'),
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token is missing').optional(),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: optionalEmailSchema.optional(),
    preferredLanguage: languageSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No changes supplied',
  });
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
