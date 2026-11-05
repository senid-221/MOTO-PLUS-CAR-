import { HttpStatus } from '@nestjs/common';
import type { ApiErrorDetail, ErrorCode } from '@seremoto/shared-types';

/**
 * Domain error carrying the HTTP status and the machine-readable code that
 * clients switch on. Anything thrown that is not an ApiError is reported as
 * INTERNAL_ERROR so internals never leak through the response body.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: HttpStatus;
  readonly details: ApiErrorDetail[];

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends ApiError {
  constructor(details: ApiErrorDetail[], message = 'Invalid request') {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have access to this') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists', details: ApiErrorDetail[] = []) {
    super('CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = 'Too many requests, please wait before trying again') {
    super('RATE_LIMITED', message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class AccountNotActiveError extends ApiError {
  constructor(message = 'This account is not active') {
    super('ACCOUNT_NOT_ACTIVE', message, HttpStatus.FORBIDDEN);
  }
}

export class InvalidOtpError extends ApiError {
  constructor(message = 'That code is not correct') {
    super('INVALID_OTP', message, HttpStatus.UNAUTHORIZED);
  }
}

export class OtpExpiredError extends ApiError {
  constructor(message = 'That code expired. Request a new one.') {
    super('OTP_EXPIRED', message, HttpStatus.GONE);
  }
}

export class OtpAttemptLimitError extends ApiError {
  constructor(message = 'Too many attempts. Request a new code.') {
    super('OTP_TOO_MANY_ATTEMPTS', message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class TokenExpiredError extends ApiError {
  constructor(message = 'Your session expired. Log in again.') {
    super('TOKEN_EXPIRED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class TokenInvalidError extends ApiError {
  constructor(message = 'Session is not valid') {
    super('TOKEN_INVALID', message, HttpStatus.UNAUTHORIZED);
  }
}
