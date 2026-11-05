import { HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';
import { ApiExceptionFilter } from './api-exception.filter';
import { ConflictError, ValidationError } from './api-error';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  clearRefreshCookie,
  readCookie,
  serializeRefreshCookie,
} from './cookies';
import type { ApiSuccessBody } from '@seremoto/shared-types';
import type { ArgumentsHost, CallHandler, ExecutionContext } from '@nestjs/common';

function hostFor(response: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ originalUrl: '/api/v1/auth/login' }),
    }),
  } as unknown as ArgumentsHost;
}

function jsonRecorder() {
  const sent: Array<{ status: number; body: unknown }> = [];
  const response = {
    status(code: number) {
      return {
        json(body: unknown) {
          sent.push({ status: code, body });
        },
      };
    },
  };
  return { response, sent };
}

describe('ApiResponseInterceptor', () => {
  it('wraps a payload in the documented success envelope', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = { getType: () => 'http' } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: 'user-1' }) } as unknown as CallHandler<unknown>;

    const body = (await firstValueFrom(
      interceptor.intercept(context, next),
    )) as ApiSuccessBody<unknown>;
    expect(body).toEqual({
      success: true,
      data: { id: 'user-1' },
      message: 'Operation completed successfully',
    });
  });

  it('keeps a null payload distinguishable from an error', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = { getType: () => 'http' } as unknown as ExecutionContext;
    const next = { handle: () => of(null) } as unknown as CallHandler<unknown>;
    const body = (await firstValueFrom(
      interceptor.intercept(context, next),
    )) as ApiSuccessBody<unknown>;
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });
});

describe('ApiExceptionFilter', () => {
  it('reports a domain error with its own code, status and details', () => {
    const { response, sent } = jsonRecorder();
    new ApiExceptionFilter().catch(
      new ValidationError(
        [{ field: 'phone', message: 'Enter a valid Rwandan number' }],
        'Invalid request',
      ),
      hostFor(response),
    );
    expect(sent[0]?.status).toBe(HttpStatus.BAD_REQUEST);
    expect(sent[0]?.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: [{ field: 'phone', message: 'Enter a valid Rwandan number' }],
      },
    });
  });

  it('keeps a conflict distinguishable from a validation failure', () => {
    const { response, sent } = jsonRecorder();
    new ApiExceptionFilter().catch(
      new ConflictError('Phone already registered'),
      hostFor(response),
    );
    expect(sent[0]?.status).toBe(HttpStatus.CONFLICT);
    expect((sent[0]?.body as { error: { code: string } }).error.code).toBe('CONFLICT');
  });

  it('translates a framework exception into the same envelope', () => {
    const { response, sent } = jsonRecorder();
    new ApiExceptionFilter().catch(
      new HttpException({ message: ['name must be a string'] }, HttpStatus.BAD_REQUEST),
      hostFor(response),
    );
    const body = sent[0]?.body as { error: { code: string; message: string; details: unknown[] } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid request');
    expect(body.error.details).toEqual([{ message: 'name must be a string' }]);
  });

  it('never echoes an unexpected internal failure to the client', () => {
    const { response, sent } = jsonRecorder();
    new ApiExceptionFilter().catch(
      new Error('connection refused to postgresql://internal-host:5432'),
      hostFor(response),
    );
    const body = sent[0]?.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('postgres');
    expect(sent[0]?.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe('refresh cookie serialisation', () => {
  it('is httpOnly, scoped to the auth routes and never readable by page scripts', () => {
    const cookie = serializeRefreshCookie('abc123', { maxAgeSeconds: 2_592_000, secure: false });
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=abc123`);
    expect(cookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('adds Secure only when the deployment is https', () => {
    const cookie = serializeRefreshCookie('abc', { maxAgeSeconds: 60, secure: true });
    expect(cookie).toContain('Secure');
  });

  it('clears by expiring immediately on the same path', () => {
    const cookie = clearRefreshCookie(true);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain(`Path=${REFRESH_COOKIE_PATH}`);
  });

  it('reads the value back out of a request header', () => {
    const header = `other=1; ${REFRESH_COOKIE_NAME}=abc%20def; third=2`;
    expect(readCookie(header, REFRESH_COOKIE_NAME)).toBe('abc def');
    expect(readCookie(header, 'missing')).toBeNull();
    expect(readCookie(undefined, REFRESH_COOKIE_NAME)).toBeNull();
  });
});
