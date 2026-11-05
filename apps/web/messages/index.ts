/**
 * The web app never hardcodes user-facing copy. Every string on screen comes
 * from the shared dictionaries through the helper below, so a missing
 * translation is a build-visible mistake rather than English leaking into a
 * Kinyarwanda interface.
 */
import type { Language } from '@seremoto/shared-types';
import { t as lookup, type TranslationKey } from '@seremoto/localization';

export type { TranslationKey };

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Binds a language to the dictionary lookup so components only pass keys. */
export function makeTranslator(language: Language): Translate {
  return (key, vars) => lookup(language, key, vars);
}

/** Convenience for server components that already resolved the language. */
export function translate(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  return lookup(language, key, vars);
}
