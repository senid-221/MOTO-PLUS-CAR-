/**
 * The browser's only way to reach the backend.
 *
 * Every call is a relative URL against this origin, so the request lands on the
 * same-origin proxy, which supplies the Bearer token from the httpOnly cookie
 * and keeps the refresh cookie first-party. Page code therefore never handles a
 * token, and a 401 is repaired once, silently, by asking the proxy to refresh
 * before the failure is shown to the user.
 */
import type { ApiErrorBody, ApiErrorDetail, ApiResult, ErrorCode } from '@seremoto/shared-types';

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** A failure the interface can explain: it carries the API's machine code and status. */
export class ApiFailure extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetail[];
  /** True when the API could not be reached at all, as opposed to answering with an error. */
  readonly unreachable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details: ApiErrorDetail[] = [],
    unreachable = false,
  ) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.status = status;
    this.details = details;
    this.unreachable = unreachable;
  }
}

/**
 * Routes that must never trigger a refresh attempt: the endpoints that issue or
 * end a session. Calling refresh from inside them would recurse.
 */
const NEVER_REFRESH = new Set(['auth/refresh', 'auth/logout', 'auth/verify-otp', 'health']);

interface Outcome<T> {
  status: number;
  result: ApiResult<T>;
}

async function send<T>(path: string, method: ApiMethod, body?: unknown): Promise<Outcome<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure('INTERNAL_ERROR', 'Network request failed', 0, [], true);
  }

  // The proxy answers 502 itself when the API host is unreachable, which is a
  // connectivity problem for the user rather than an application error.
  if (response.status === 502) {
    throw new ApiFailure('INTERNAL_ERROR', 'The API is not reachable', 502, [], true);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiFailure(
      'INTERNAL_ERROR',
      `Unexpected ${response.status} response without a JSON body`,
      response.status,
    );
  }

  const payload = (await response.json()) as ApiResult<T>;
  if (!payload || typeof payload !== 'object' || !('success' in payload)) {
    throw new ApiFailure('INTERNAL_ERROR', 'Malformed response from the API', response.status);
  }
  return { status: response.status, result: payload };
}

function toFailure(error: ApiErrorBody['error'], status: number): ApiFailure {
  const details = error.details ?? [];
  const unreachable = details.some((detail) => detail.code === 'upstream_unreachable');
  return new ApiFailure(error.code, error.message, status, details, unreachable);
}

export interface RequestOptions {
  method?: ApiMethod;
  body?: unknown;
}

/**
 * Requests `path` and resolves with the `data` of a successful envelope.
 *
 * An UNAUTHENTICATED answer on a session-bearing route triggers exactly one
 * refresh and one retry; anything else throws ApiFailure so the caller can
 * localise the reason.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const first = await send<T>(path, method, options.body);

  if (first.result.success) return first.result.data;

  const shouldRefresh = first.result.error.code === 'UNAUTHENTICATED' && !NEVER_REFRESH.has(path);

  if (!shouldRefresh) throw toFailure(first.result.error, first.status);

  const refreshed = await send('auth/refresh', 'POST');
  if (!refreshed.result.success) {
    // Nothing left to renew. Report the original problem, not the refresh error.
    throw toFailure(first.result.error, first.status);
  }

  const retry = await send<T>(path, method, options.body);
  if (retry.result.success) return retry.result.data;
  throw toFailure(retry.result.error, retry.status);
}

/** Shorthand used by the forms and panels. */
export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
};
