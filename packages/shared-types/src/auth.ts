import type { UserRole, Language } from './enums';
import type { CurrentUserSummary } from './api';

export interface RegisterInput {
  fullName: string;
  phone: string;
  preferredLanguage?: Language;
  roles?: UserRole[];
}

export interface RegisterOutput {
  userId: string;
  phone: string;
  verificationRequired: boolean;
  /** How long the code stays valid, in seconds. */
  expiresInSeconds: number;
  /** The purpose the code was issued for; a client must send it back when confirming. */
  purpose: OtpPurposeName;
  /** Present only when SMS_PROVIDER=log in non-production environments. */
  devOtpCode?: string;
}

export interface SendOtpInput {
  phone: string;
  purpose?: OtpPurposeName;
}

export type OtpPurposeName = 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET' | 'PHONE_CHANGE';

export interface SendOtpOutput {
  /** The number the code was sent to, normalised to E.164 by the API. */
  phone: string;
  /**
   * Which purpose the code covers. A number whose phone was never confirmed gets
   * a REGISTER code even when the visitor asked to log in, so the confirm step has
   * to be told rather than guessed.
   */
  purpose: OtpPurposeName;
  expiresInSeconds: number;
  /** Present only when SMS_PROVIDER=log in non-production environments. */
  devOtpCode?: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
  purpose?: OtpPurposeName;
}

/** Tokens returned after a verified phone. The refresh token is also set as an httpOnly cookie. */
export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

export interface AuthSession {
  tokens: SessionTokens;
  user: CurrentUserSummary;
}

export interface LoginInput {
  phone: string;
}

export interface SessionDeviceInfo {
  sessionId: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface UpdateProfileInput {
  fullName?: string;
  email?: string | null;
  preferredLanguage?: Language;
}
