/**
 * Server-only session helpers. Anything here reads the request cookie jar, so
 * it must never be imported from a client component.
 */
import { cookies } from 'next/headers';
import { ACCESS_COOKIE_NAME } from './cookies';

/**
 * Cheap signed-in hint used to choose the nav link and to redirect away from
 * the login pages. It is not an authorisation decision: every protected screen
 * asks the API, and an expired token is reported as an expired session rather
 * than a valid one.
 */
export async function hasAccessTokenCookie(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(ACCESS_COOKIE_NAME)?.value;
  return typeof value === 'string' && value.length > 0;
}
