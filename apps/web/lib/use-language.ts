'use client';

/**
 * The language switch, shared by the header pill and the phone tab bar so both
 * behave identically: write `sere_lang` through the locale route, then re-render
 * the current route on the server. No reload, and no cookie is touched, so the
 * signed-in session survives the change.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@seremoto/shared-types';

export interface LanguageSwitch {
  /** Writes the new language and refreshes the screen. Same value is a no-op. */
  choose: (next: Language) => void;
  /** True while the switch is in flight; controls are disabled meanwhile. */
  pending: boolean;
}

export function useLanguageSwitch(language: Language): LanguageSwitch {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Language): void {
    if (next === language || pending) return;
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

  return { choose, pending };
}

/** The other language, for a one-tap switch. */
export function otherLanguage(language: Language): Language {
  return language === 'rw' ? 'en' : 'rw';
}
