'use client';

/**
 * One tap to switch language, no page reload and no logout. The behaviour lives
 * in `useLanguageSwitch`; this is the desktop presentation — two short codes in
 * one pill, which becomes a single-tap globe in the phone tab bar.
 */
import type { Language } from '@seremoto/shared-types';
import { makeTranslator } from '@/messages';
import { useLanguageSwitch } from '@/lib/use-language';

const SHORT_LABELS: Record<Language, string> = { rw: 'KIN', en: 'ENG' };

export function LanguageToggle({ language }: { language: Language }) {
  const t = makeTranslator(language);
  const { choose, pending } = useLanguageSwitch(language);

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
