/**
 * Domain enums shared by the API, web and (later) mobile applications.
 * Values mirror `prisma/schema.prisma` exactly — change both together.
 */

export const USER_ROLES = [
  'CUSTOMER',
  'RIDER',
  'MERCHANT',
  'GARAGE',
  'COOPERATIVE_MANAGER',
  'BUSINESS_CLIENT',
  'SUPPORT',
  'MODERATOR',
  'FINANCE',
  'OPERATIONS',
  'VERIFICATION_OFFICER',
  'CONTENT_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const RIDER_STATUSES = ['OFFLINE', 'ONLINE', 'BUSY', 'SUSPENDED'] as const;
export type RiderStatus = (typeof RIDER_STATUSES)[number];

export const SERVICE_TYPES = ['RIDE', 'CARGO', 'SHOPPING', 'MONTHLY', 'BUSINESS_DELIVERY'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const BOOKING_STATUSES = [
  'REQUESTED',
  'MATCHING',
  'ACCEPTED',
  'ARRIVING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'DISPUTED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['MTN_MOMO'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const DOCUMENT_TYPES = [
  'NATIONAL_ID',
  'DRIVING_LICENSE',
  'MOTORCYCLE_REGISTRATION',
  'INSURANCE',
  'BUSINESS_LICENSE',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCT_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'OUT_OF_STOCK',
  'SUSPENDED',
  'ARCHIVED',
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CONTRACT_STATUSES = [
  'DRAFT',
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'READ'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const TRANSACTION_TYPES = [
  'CREDIT',
  'DEBIT',
  'REFUND',
  'COMMISSION',
  'SETTLEMENT',
  'ADJUSTMENT',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const OTP_PURPOSES = ['REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_CHANGE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const SESSION_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Supported interface languages. Kinyarwanda is the default. */
export const LANGUAGES = ['rw', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'rw';
export const DEFAULT_CURRENCY = 'RWF' as const;
