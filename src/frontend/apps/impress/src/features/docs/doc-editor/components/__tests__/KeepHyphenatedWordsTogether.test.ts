import { describe, expect, test } from 'vitest';

import { getHyphenatedWordRanges } from '../KeepHyphenatedWordsTogether';

describe('getHyphenatedWordRanges', () => {
  test('finds a hyphenated name at the correct position', () => {
    const text = 'Soleilnuit Lune, Jean-Marc Niche';

    expect(getHyphenatedWordRanges(text)).toEqual([
      {
        from: text.indexOf('Jean-Marc'),
        to: text.indexOf('Jean-Marc') + 'Jean-Marc'.length,
      },
    ]);
  });

  test('finds each compound word without including punctuation', () => {
    const text = 'well-known, up-to-date.';

    expect(
      getHyphenatedWordRanges(text).map(({ from, to }) => text.slice(from, to)),
    ).toEqual(['well-known', 'up-to-date']);
  });

  test('ignores dashes surrounded by spaces', () => {
    expect(getHyphenatedWordRanges('one - two')).toEqual([]);
  });
});
