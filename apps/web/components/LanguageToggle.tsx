'use client';

/**
 * One tap to switch language, no page reload and no logout. The choice is
 * written to the `sere_lang` cookie by the locale route, then the current route
 * re-renders on the server with the new dictionary. Cookies are not touched, so
 * the signed-in session is exactly the same before and after.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';

const SHORT_LABELS: Record<Language, string> = { rw: 'KIN', en: 'ENG' };

export function LanguageToggle({ language }: { language: Language }) {
  const router = useRouter();
  const t = makeTranslator(language);
  const [pending, startTransition] = useTransition();

  function choose(next: Language): void {
    if (next === language) return;
    startTransition(async () => {
      try {
        await fetch('/api/locale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language: next }),
        });
      } catch {
        // The cookie write failed; the refresh below leaves the language as it was.
      }
      router.refresh();
    });
  }

  return (
    <div className="language-toggle" role="group" aria-label={t('nav.language')}>
      {(['rw', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => choose(code)}
          aria-pressed={code === language}
          disabled={pending}
          title={code === 'rw' ? t('language.rw') : t('language.en')}
        >
          {SHORT_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
