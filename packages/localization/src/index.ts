import type { Language } from '@seremoto/shared-types';
import { en, type TranslationKey } from './en';
import { rw } from './rw';

export type { TranslationKey } from './en';
export { en } from './en';
export { rw } from './rw';

export const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  en,
  rw,
};

export const TRANSLATION_KEYS = Object.keys(en) as TranslationKey[];

/** Substitute {placeholders} in a translated string. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/** Look up a key, falling back to English and finally to the key itself. */
export function t(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[language]?.[key] ?? en[key] ?? key;
  return vars ? interpolate(template, vars) : template;
}

const KIGALI_TIME_ZONE = 'Africa/Kigali';

/** Rwanda money display: no decimals for whole francs, e.g. "1,500 RWF". */
export function formatRwf(amount: string | number, language: Language = 'rw'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat(language === 'rw' ? 'en-GB' : language, {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** Date and time in Central Africa Time, e.g. "05/11/2026 14:30". */
export function formatDateTime(date: Date | string, language: Language = 'rw'): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(language === 'rw' ? 'rw-RW' : 'en-GB', {
    timeZone: KIGALI_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

export function formatDate(date: Date | string, language: Language = 'rw'): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(language === 'rw' ? 'rw-RW' : 'en-GB', {
    timeZone: KIGALI_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}
