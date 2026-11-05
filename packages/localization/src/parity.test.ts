import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { en } from './en';
import { rw } from './rw';
import { DICTIONARIES, TRANSLATION_KEYS, interpolate, t } from './index';

const enKeys = Object.keys(en);
const rwKeys = Object.keys(rw);

describe('localization key parity', () => {
  it('has the same key set in both languages', () => {
    const missingInRw = enKeys.filter((key) => !rwKeys.includes(key));
    const extraInRw = rwKeys.filter((key) => !enKeys.includes(key));
    expect({ missingInRw, extraInRw }).toEqual({ missingInRw: [], extraInRw: [] });
  });

  it('has no empty values', () => {
    const empty = [
      ...enKeys.filter((key) => en[key as keyof typeof en].trim() === ''),
      ...rwKeys.filter((key) => rw[key as keyof typeof rw].trim() === ''),
    ];
    expect(empty).toEqual([]);
  });

  it('declares each key exactly once per source file', () => {
    ['en.ts', 'rw.ts'].forEach((file) => {
      const source = readFileSync(join(__dirname, file), 'utf8');
      const declarations = [...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]);
      const duplicates = declarations.filter(
        (key, index) => key !== undefined && declarations.indexOf(key) !== index,
      );
      expect({ file, duplicates, declared: declarations.length }).toEqual({
        file,
        duplicates: [],
        declared: enKeys.length,
      });
    });
  });

  it('exposes both languages through the dictionary', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual(['en', 'rw']);
    expect(TRANSLATION_KEYS.length).toBe(enKeys.length);
  });
});

describe('translation lookup', () => {
  it('returns Kinyarwanda copy', () => {
    expect(t('rw', 'nav.login')).toBe('Injira');
  });

  it('interpolates placeholders', () => {
    expect(
      interpolate('Sent to {phone} in {minutes} min', { phone: '+250781234567', minutes: 5 }),
    ).toBe('Sent to +250781234567 in 5 min');
  });

  it('keeps an unfilled placeholder rather than printing undefined', () => {
    expect(interpolate('Sent to {phone}', { other: 'x' })).toBe('Sent to {phone}');
  });

  it('fills the OTP subtitle in both languages', () => {
    ['rw', 'en'].forEach((language) => {
      const text = t(language as 'rw' | 'en', 'auth.otp.subtitle', {
        phone: '0781234567',
        minutes: 5,
      });
      expect(text).toContain('0781234567');
      expect(text).not.toContain('{');
    });
  });
});
