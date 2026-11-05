/**
 * Session plumbing shared by the proxy route, the pages and the API client.
 *
 * `BrowserAuthSession` is deliberately narrower than the API's `AuthSession`:
 * it has no access token field at all, so a page component cannot accidentally
 * read, log or render one. The full token stays on the server and in the
 * httpOnly `sere_access` cookie. This module has no Next.js imports so it is
 * safe to use from a client component.
 */
import type { AuthSession, CurrentUserSummary, SessionTokens } from '@seremoto/shared-types';

export interface BrowserAuthSession {
  tokens: { refreshTokenExpiresInSeconds: number };
  user: CurrentUserSummary;
}

export interface SplitSession {
  /** Empty string when the API did not issue a token, which the proxy treats as "nothing to store". */
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  session: BrowserAuthSession;
}

export function splitSession(session: AuthSession): SplitSession {
  const tokens: Partial<SessionTokens> = session.tokens ?? {};
  return {
    accessToken: tokens.accessToken ?? '',
    accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds ?? 0,
    session: {
      user: session.user,
      tokens: { refreshTokenExpiresInSeconds: tokens.refreshTokenExpiresInSeconds ?? 0 },
    },
  };
}
