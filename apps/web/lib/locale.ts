/**
 * Language resolution. Kinyarwanda is the default because it is the language of
 * the launch market; a visitor who never touches the switch still gets `rw`.
 *
 * Order of preference: the `sere_lang` cookie (set by the switch), then the
 * browser's Accept-Language, then the default. The cookie is what makes the
 * choice survive login, logout and a reload.
 */
import { cookies, headers } from 'next/headers';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@seremoto/shared-types';
import { LANGUAGE_COOKIE_NAME, readCookieValue } from './cookies';

export const LANGUAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Accept-Language looks like "en-GB,en;q=0.9,rw;q=0.8"; quality decides the order. */
export function languageFromAcceptHeader(value: string | null | undefined): Language | null {
  if (!value) return null;
  const ordered = value
    .split(',')
    .map((part) => {
      const [tag, q = 'q=1'] = part.trim().split(';');
      const quality = Number(q.replace('q=', ''));
      return { tag: (tag ?? '').toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ordered) {
    const base = entry.tag.split('-')[0];
    if (base === 'rw' || base === 'kin' || base === 'kinyarwanda') return 'rw';
    if (base === 'en') return 'en';
  }
  return null;
}

export async function resolveLanguage(): Promise<Language> {
  const jar = await cookies();
  const fromCookie = jar.get(LANGUAGE_COOKIE_NAME)?.value;
  if (isLanguage(fromCookie)) return fromCookie;

  const requestHeaders = await headers();
  return languageFromAcceptHeader(requestHeaders.get('accept-language')) ?? DEFAULT_LANGUAGE;
}

/** Available for server code that has a raw header instead of the cookie jar. */
export function languageFromCookieHeader(cookieHeader: string | null): Language | null {
  const value = readCookieValue(cookieHeader, LANGUAGE_COOKIE_NAME);
  return isLanguage(value) ? value : null;
}
