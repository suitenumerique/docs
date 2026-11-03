import { describe, expect, it } from 'vitest';

import { normalizeEmoji } from '../normalizeEmoji';

describe('normalizeEmoji', () => {
  it('drops the variation selector of an emoji drawn as an emoji', () => {
    expect(normalizeEmoji('\u{1F44D}️')).toBe('\u{1F44D}');
  });

  it('keeps the variation selector where it picks the emoji style', () => {
    expect(normalizeEmoji('❤️')).toBe('❤️');
  });

  it('leaves the other emojis as they are', () => {
    expect(normalizeEmoji('\u{1F44D}')).toBe('\u{1F44D}');
    expect(normalizeEmoji('\u{1F44D}\u{1F3FD}')).toBe('\u{1F44D}\u{1F3FD}');
    expect(normalizeEmoji('1️⃣')).toBe('1️⃣');
  });
});
