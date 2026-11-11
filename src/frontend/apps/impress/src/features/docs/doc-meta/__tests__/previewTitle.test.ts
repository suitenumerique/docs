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

  it('leaves Latin titles alone', () => {
    expect(previewTitle('Plan for 2027')).toEqual({
      rtl: false,
      words: ['Plan', 'for', '2027'],
    });
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
