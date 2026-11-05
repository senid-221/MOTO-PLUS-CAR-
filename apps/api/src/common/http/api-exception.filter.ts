import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorDetail, ErrorCode } from '@seremoto/shared-types';
import { ApiError } from './api-error';

const STATUS_CODE_MAP: Partial<Record<HttpStatus, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    let details: ApiErrorDetail[] = [];

    if (exception instanceof ApiError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as { message?: string | string[] };
        if (Array.isArray(body.message)) {
          details = body.message.map((item) => ({ message: item }));
          message = 'Invalid request';
        } else if (typeof body.message === 'string') {
          message = body.message;
        }
      }
    } else if (exception instanceof Error) {
      // Unexpected failures are logged in full but never echoed to the client.
      this.logger.error(`${exception.name}: ${exception.message}\n${exception.stack ?? ''}`);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.warn(`Unhandled ${code} at ${requestPath(host)}`);
    }

    const body: ApiErrorBody = {
      success: false,
      error: { code, message, details },
    };
    response.status(status).json(body);
  }
}

function requestPath(host: ArgumentsHost): string {
  const request = host.switchToHttp().getRequest<{ originalUrl?: string }>();
  return request.originalUrl ?? 'unknown';
}
