import { describe, expect, it } from 'vitest';

import { getClosestLocale, getMatchingLocales } from '../locale';

const LOCALES = ['en-us', 'fr-fr', 'zh-cn', 'zh-tw'];

describe('getMatchingLocales', () => {
  it('returns every region of a language on a soft match', () => {
    expect(getMatchingLocales(LOCALES, ['zh'])).toEqual(['zh-cn', 'zh-tw']);
  });

  it('only returns the exact match when there is one', () => {
    expect(getMatchingLocales(LOCALES, ['zh-TW'])).toEqual(['zh-tw']);
  });
});

describe('getClosestLocale', () => {
  it.each([
    ['zh-tw', 'zh-tw'],
    ['zh-cn', 'zh-cn'],
    ['zh-TW', 'zh-tw'],
    ['fr', 'fr-fr'],
    ['fr-CA', 'fr-fr'],
    ['en', 'en-us'],
  ])('resolves %s to %s', (language, expected) => {
    expect(getClosestLocale(LOCALES, language)).toBe(expected);
  });

  it('prefers the exact match over the first region of the language', () => {
    expect(getClosestLocale(['en-us', 'en-gb'], 'en-gb')).toBe('en-gb');
  });

  it('returns a single locale, never every region', () => {
    const selected = LOCALES.filter(
      (locale) => locale === getClosestLocale(LOCALES, 'zh-tw'),
    );
    expect(selected).toEqual(['zh-tw']);
  });

  it('returns undefined when no locale shares the language', () => {
    expect(getClosestLocale(LOCALES, 'ja')).toBeUndefined();
    expect(getClosestLocale([], 'fr')).toBeUndefined();
  });
});
