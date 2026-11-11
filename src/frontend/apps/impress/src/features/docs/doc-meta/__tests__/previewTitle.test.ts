import { describe, expect, it } from 'vitest';

import { joinArabic, previewTitle, visualWord } from '../previewTitle';

const forms = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

describe('previewTitle', () => {
  it('reverses Hebrew words and keeps their order for a row-reverse row', () => {
    expect(previewTitle('שלום עולם')).toEqual({
      rtl: true,
      words: ['םולש', 'םלוע'],
    });
  });

  it('keeps an English run and a mixed word readable in a Hebrew title', () => {
    expect(previewTitle('תכנית עם React Native ו-Expo')?.words).toEqual([
      'תינכת',
      'םע',
      'React Native',
      'Expo-ו',
    ]);
  });

  it('keeps a number inside the run it is in', () => {
    expect(previewTitle('גרסה React 18 Native')?.words).toEqual([
      'הסרג',
      'React 18 Native',
    ]);
  });

  it('reverses a Hebrew run in an English title, a number after it included', () => {
    // As a browser shows it: "Plan 2027 עולם שלום"
    expect(previewTitle('Plan שלום עולם 2027')).toEqual({
      rtl: false,
      words: ['Plan', '2027 םלוע םולש'],
    });
  });

  it('mirrors brackets and drops vowel marks', () => {
    expect(previewTitle('(טיוטה) שָׁלוֹם')?.words).toEqual(['(הטויט)', 'םולש']);
  });

  it('leaves Latin titles alone, punctuation included', () => {
    expect(previewTitle('Plan for 2027')).toEqual({
      rtl: false,
      words: ['Plan', 'for', '2027'],
    });
    expect(previewTitle('Roadmap (draft) [WIP] f(x) -> e.g., (2027)')).toEqual({
      rtl: false,
      words: ['Roadmap', '(draft)', '[WIP]', 'f(x)', '->', 'e.g.,', '(2027)'],
    });
  });

  it('keeps Latin words and numbers in brackets readable in a Hebrew title', () => {
    expect(previewTitle('שלום (draft) גרסה (2027)')?.words).toEqual([
      'םולש',
      '(draft)',
      'הסרג',
      '(2027)',
    ]);
  });

  it('writes Arabic-Indic and Persian digits left to right', () => {
    expect(previewTitle('خطة ٢٠٢٧ ۱۴۰۶')?.words).toEqual([
      visualWord('خطة'),
      '٢٠٢٧',
      '۱۴۰۶',
    ]);
  });

  it('keeps punctuation words inside the run around them', () => {
    expect(previewTitle('מדריך React & Redux')?.words).toEqual([
      'ךירדמ',
      'React & Redux',
    ]);
    expect(previewTitle('Plan שלום – עולם')?.words).toEqual([
      'Plan',
      'םלוע – םולש',
    ]);
  });

  it('mirrors a lone arrow in a Hebrew title', () => {
    expect(previewTitle('א -> ב')?.words).toEqual(['א', '<-', 'ב']);
  });

  it('accepts the Persian zero-width non-joiner', () => {
    expect(previewTitle('می‌خواهم')).not.toBeNull();
  });

  it('gives up on characters the card fonts lack', () => {
    expect(previewTitle('Done ✓')).toBeNull();
    expect(previewTitle('计划')).toBeNull();
  });
});

describe('joinArabic', () => {
  it('picks the initial, medial and final forms', () => {
    // بتب: beh initial, teh medial, beh final
    expect(joinArabic('بتب')).toBe(forms(0xfe91, 0xfe98, 0xfe90));
  });

  it('does not join after a letter that only joins on its right', () => {
    // داد: dal isolated, alef isolated, dal isolated
    expect(joinArabic('داد')).toBe(forms(0xfea9, 0xfe8d, 0xfea9));
  });

  it('keeps hamza on its own, after a final letter', () => {
    // شيء: sheen initial, yeh final, hamza
    expect(joinArabic('شيء')).toBe(forms(0xfeb7, 0xfef2, 0xfe80));
  });

  it('makes the lam-alef ligature', () => {
    expect(joinArabic('لا')).toBe(forms(0xfefb));
    // بلا: beh initial, then the final lam-alef
    expect(joinArabic('بلا')).toBe(forms(0xfe91, 0xfefc));
  });
});

describe('visualWord', () => {
  it('draws joined Arabic from the right', () => {
    expect(visualWord('بب')).toBe(forms(0xfe90, 0xfe91));
  });
});
