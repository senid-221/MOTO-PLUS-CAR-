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
 * NODE_ENV is widened to string here: the bundler replaces the expression with a
 * literal, which would otherwise make the `staging` comparison a type error even
 * though the value can be staging when the app runs.
 */
const nodeEnv: string = process.env.NODE_ENV ?? 'development';

export const IS_PRODUCTION_LIKE: boolean = nodeEnv === 'production' || nodeEnv === 'staging';

/** Milliseconds to wait before giving up on an upstream call. */
export const UPSTREAM_TIMEOUT_MS: number = Number(process.env.WEB_UPSTREAM_TIMEOUT_MS ?? 10_000);
