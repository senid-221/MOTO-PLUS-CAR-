/**
 * Server-side configuration for the web app.
 *
 * This module is imported only by route handlers, server components and
 * middleware code — never by a client component. `API_BASE_URL` must stay
 * server-side so the browser cannot discover or call the API origin directly;
 * every browser request goes through the same-origin proxy instead.
 */

/** The API origin plus its global prefix, e.g. http://localhost:4000/api/v1. */
export const API_BASE_URL: string = (
  process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

/** Scheme + host + port of the API, used for routes outside the prefix (/health). */
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/v1$/, '');

/** Public address of this web app. Only used for metadata and redirects. */
export const WEB_URL: string = (process.env.APP_WEB_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/**
 * The public source repository. The contact page points here because it is the one
 * channel that genuinely exists today — issues are filed against it — and it can be
 * overridden per deployment the same way as the other addresses.
 */
export const REPO_URL: string = (
  process.env.APP_REPO_URL ?? 'https://github.com/senid-221/MOTO-PLUS-CAR-'
).replace(/\/+$/, '');

/**
 * NODE_ENV is widened to string here: the bundler replaces the expression with a
 * literal, which would otherwise make the `staging` comparison a type error even
 * though the value can be staging when the app runs.
 */
const nodeEnv: string = process.env.NODE_ENV ?? 'development';

export const IS_PRODUCTION_LIKE: boolean = nodeEnv === 'production' || nodeEnv === 'staging';

/**
 * Milliseconds to wait before giving up on an upstream call.
 *
 * Generous on purpose: the hosted PostgreSQL endpoint used in development sleeps
 * when idle, and the first request after a quiet period pays for waking it. A
 * 10-second ceiling was measured against exactly that — `POST /api/v1/auth/logout`
 * came back 502 after 10156ms while the database was still coming up, so a
 * perfectly good sign-out looked like a failure and left the session cookie in
 * place. The web server must not be the tightest link in the chain.
 */
export const UPSTREAM_TIMEOUT_MS: number = Number(process.env.WEB_UPSTREAM_TIMEOUT_MS ?? 30_000);
