/**
 * Cookie names and serialisation used by the same-origin API proxy.
 *
 * Two cookies exist on the web origin:
 *
 *  - `sere_access` holds the short-lived access JWT. It is httpOnly, so page
 *    JavaScript can never read it, and the proxy attaches it as a Bearer header
 *    on every API call. The token is removed from API responses before they
 *    reach the browser.
 *  - `sere_lang` holds the interface language. It is readable on purpose: the
 *    language switch happens client-side and must survive a reload, a login and
 *    a logout without losing the session.
 *
 * The refresh cookie (`sere_refresh`) is set by the API itself with
 * Path=/api/v1/auth. Because the proxy is mounted at /api/v1, that path matches
 * the URL the browser actually requests, so the cookie stays first-party and is
 * only ever sent to auth routes.
 */

export const ACCESS_COOKIE_NAME = 'sere_access';
export const LANGUAGE_COOKIE_NAME = 'sere_lang';

export const ACCESS_COOKIE_PATH = '/';
export const LANGUAGE_COOKIE_PATH = '/';

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
  path?: string;
}

function sameSiteValue(sameSite: 'lax' | 'strict' | 'none'): string {
  return sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax';
}

/** Builds a Set-Cookie value. `SameSite=Lax` keeps top-level navigations working. */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions & { httpOnly?: boolean; sameSite?: 'lax' | 'strict' | 'none' },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    `SameSite=${sameSiteValue(options.sameSite ?? 'lax')}`,
  ];
  if (options.httpOnly ?? true) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function serializeAccessCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  return serializeCookie(ACCESS_COOKIE_NAME, token, {
    maxAgeSeconds,
    secure,
    path: ACCESS_COOKIE_PATH,
  });
}

export function clearAccessCookie(secure: boolean): string {
  return serializeAccessCookie('', 0, secure);
}

export function serializeLanguageCookie(
  language: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  return serializeCookie(LANGUAGE_COOKIE_NAME, language, {
    maxAgeSeconds,
    secure,
    path: LANGUAGE_COOKIE_PATH,
    httpOnly: false,
  });
}

/** Reads one cookie out of a raw Cookie header. */
export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() !== name) continue;
    const raw = pair.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
