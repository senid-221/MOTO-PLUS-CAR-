/**
 * Language switch.
 *
 * Writing the `sere_lang` cookie is the whole job. The session is untouched:
 * the access and refresh cookies are separate, so changing between Kinyarwanda
 * and English never logs anyone out. A JSON call from the toggle gets a small
 * acknowledgement; a form post (no JavaScript) is redirected back to where the
 * visitor came from, so the same button works either way.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { IS_PRODUCTION_LIKE } from '@/lib/env';
import { serializeLanguageCookie } from '@/lib/cookies';
import { LANGUAGE_MAX_AGE_SECONDS, isLanguage } from '@/lib/locale';

export const dynamic = 'force-dynamic';

function setLanguage(response: NextResponse, language: string): void {
  response.headers.append(
    'set-cookie',
    serializeLanguageCookie(language, LANGUAGE_MAX_AGE_SECONDS, IS_PRODUCTION_LIKE),
  );
}

function safeTarget(raw: string | null): string {
  // Only same-site relative paths, never an absolute URL an attacker could point at.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') ?? '';

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    const language = String(form.get('language') ?? '');
    const target = safeTarget(String(form.get('next') ?? ''));
    const response = NextResponse.redirect(new URL(target, request.url), 303);
    if (isLanguage(language)) setLanguage(response, language);
    return response;
  }

  let language = '';
  try {
    const body = (await request.json()) as { language?: unknown };
    language = typeof body.language === 'string' ? body.language : '';
  } catch {
    language = '';
  }

  if (!isLanguage(language)) {
    const response = NextResponse.json({ ok: false }, { status: 400 });
    return response;
  }

  const response = NextResponse.json({ ok: true, language });
  setLanguage(response, language);
  return response;
}
