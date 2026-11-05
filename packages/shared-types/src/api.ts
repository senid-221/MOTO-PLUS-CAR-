import type { UserRole } from './enums';

/** Machine-readable error codes returned by every API. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'ACCOUNT_NOT_ACTIVE',
  'RIDER_NOT_VERIFIED',
  'INVALID_OTP',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'RATE_LIMITED',
  'IDEMPOTENCY_CONFLICT',
  'PAYMENT_PROVIDER_ERROR',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/** Error envelope from section 18 of the product specification. */
export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details: ApiErrorDetail[];
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  message: string;
}

export type ApiResult<T> = ApiSuccessBody<T> | ApiErrorBody;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  database: 'up' | 'down';
  time: string;
}

export interface CurrentUserSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  status: string;
  roles: UserRole[];
  permissions: string[];
  phoneVerified: boolean;
}
