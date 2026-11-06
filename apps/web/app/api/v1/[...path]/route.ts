/**
 * Same-origin proxy between the browser and the NestJS API.
 *
 * Why this exists instead of calling the API host directly:
 *
 *  1. The refresh cookie is httpOnly and path-scoped to /api/v1/auth on the API.
 *     Served through this origin it stays a first-party cookie, so it survives
 *     the browser's third-party-cookie blocking and never needs CORS.
 *  2. The short-lived access token never has to be handed to page JavaScript.
 *     Responses from the token-issuing routes have `tokens.accessToken` removed
 *     and re-set as the httpOnly `sere_access` cookie instead, which this
 *     handler attaches to later requests as a Bearer header.
 *  3. The API host and its shape stay a server-side detail.
 *
 * The handler is a transparent pipe otherwise: method, query string, body,
 * content type, idempotency key and the upstream status and headers are copied
 * through, including every Set-Cookie header the API returns.
 */
import { API_BASE_URL, API_ORIGIN, IS_PRODUCTION_LIKE, UPSTREAM_TIMEOUT_MS } from '@/lib/env';
import {
  ACCESS_COOKIE_NAME,
  clearAccessCookie,
  readCookieValue,
  serializeAccessCookie,
} from '@/lib/cookies';
import type { ApiErrorBody, ApiResult, AuthSession } from '@seremoto/shared-types';
import { splitSession, type BrowserAuthSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/** Headers that belong to one hop only and must not be replayed upstream. */
const NON_FORWARDED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade',
  'content-length',
]);

const NON_FORWARDED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'upgrade',
  'set-cookie',
]);

/** Responses from these routes carry a fresh access token in the JSON body. */
const TOKEN_ROUTES = new Set(['auth/verify-otp', 'auth/refresh']);

function upstreamUrl(segments: string[], search: string): string {
  // /health sits outside the API's global prefix, so it needs the bare origin.
  const base = segments.length === 1 && segments[0] === 'health' ? API_ORIGIN : API_BASE_URL;
  return `${base}/${segments.join('/')}${search}`;
}

function errorResponse(
  code: ApiErrorBody['error']['code'],
  message: string,
  status: number,
  detailCode?: string,
  extraHeaders?: Headers,
): Response {
  const body: ApiErrorBody = {
    success: false,
    error: { code, message, details: detailCode ? [{ code: detailCode, message }] : [] },
  };
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  extraHeaders?.forEach((value, key) => headers.append(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

/** Drops the access token from a session payload; it lives in a cookie now. */

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const route = path.join('/');
  const method = request.method.toUpperCase();
  const cookieHeader = request.headers.get('cookie');
  const secure = IS_PRODUCTION_LIKE;

  const upstreamHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!NON_FORWARDED_REQUEST_HEADERS.has(key.toLowerCase())) upstreamHeaders.append(key, value);
  });
  upstreamHeaders.set('accept', 'application/json');

  // The browser never holds the access token, so the proxy supplies it.
  const storedToken = readCookieValue(cookieHeader, ACCESS_COOKIE_NAME);
  if (storedToken && !upstreamHeaders.has('authorization')) {
    upstreamHeaders.set('authorization', `Bearer ${storedToken}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  // Log Out has to leave this browser even when the API never answers, otherwise
  // a cold or unreachable database turns one refused call into a screen that
  // keeps offering Account and keeps sending a token the visitor tried to drop.
  const asksToSignOut = route === 'auth/logout';

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl(path, new URL(request.url).search), {
      method,
      headers: upstreamHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    const dropped = new Headers();
    if (asksToSignOut) dropped.append('set-cookie', clearAccessCookie(secure));
    return errorResponse(
      'INTERNAL_ERROR',
      'The API is not reachable from the web server.',
      502,
      'upstream_unreachable',
      dropped,
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!NON_FORWARDED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.append(key, value);
  });
  // getSetCookie() keeps each cookie on its own line; append() must not join them.
  const forwardedCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [upstream.headers.get('set-cookie')].filter((v): v is string => Boolean(v));
  forwardedCookies.forEach((value) => responseHeaders.append('set-cookie', value));
  responseHeaders.set('cache-control', 'no-store');

  const endsSession =
    asksToSignOut ||
    (route === 'auth/refresh' && (upstream.status === 401 || upstream.status === 403));
  if (endsSession) responseHeaders.append('set-cookie', clearAccessCookie(secure));

  const isJson = (upstream.headers.get('content-type') ?? '').includes('application/json');

  // Sign-in step two: move the access token out of the body, into an httpOnly cookie.
  if (isJson && upstream.ok && TOKEN_ROUTES.has(route)) {
    const payload = (await upstream.json()) as ApiResult<AuthSession>;
    if (payload.success) {
      const { session, accessToken, accessTokenExpiresInSeconds } = splitSession(payload.data);
      const sanitized: ApiResult<BrowserAuthSession> = { ...payload, data: session };
      if (accessToken) {
        responseHeaders.append(
          'set-cookie',
          serializeAccessCookie(accessToken, accessTokenExpiresInSeconds, secure),
        );
      }
      return new Response(JSON.stringify(sanitized), {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxy(request, context);
}
