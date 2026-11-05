export const REFRESH_COOKIE_NAME = 'sere_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface CookieAttributes {
  maxAgeSeconds: number;
  secure: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

/**
 * Serialises the refresh-token cookie. It is httpOnly so application
 * JavaScript cannot read it, and scoped to the auth routes so it is never
 * attached to unrelated requests.
 */
export function serializeRefreshCookie(
  token: string,
  { maxAgeSeconds, secure, sameSite = 'lax' }: CookieAttributes,
): string {
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${REFRESH_COOKIE_PATH}`,
    'HttpOnly',
    `SameSite=${sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax'}`,
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearRefreshCookie(secure: boolean): string {
  return serializeRefreshCookie('', { maxAgeSeconds: 0, secure });
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    if (key !== name) continue;
    const raw = pair.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
