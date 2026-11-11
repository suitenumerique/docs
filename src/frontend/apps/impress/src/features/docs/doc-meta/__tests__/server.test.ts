import { describe, expect, it } from 'vitest';

import { markdownToExcerpt } from '../server';

describe('markdownToExcerpt', () => {
  it('keeps the text and drops the markdown', () => {
    expect(
      markdownToExcerpt(
        '# Plan\n\nSee **the** [roadmap](https://x.test) and `code`.\n\n> A quote\n\n* one\n* [x] two\n1. three\n\n| a | b |\n| --- | --- |\n| c | d |\n',
      ),
    ).toBe('Plan See the roadmap and code. A quote one two three a b c d');
  });

  it('leaves out a first line repeating the title', () => {
    expect(markdownToExcerpt('# Plan\n\nThe text.', 'Plan')).toBe('The text.');
  });

  it('keeps right-to-left text', () => {
    expect(markdownToExcerpt('# כותרת\n\nשלום עולם', 'כותרת')).toBe(
      'שלום עולם',
    );
  });

  it('undoes the escapes of the markdown writer', () => {
    expect(
      markdownToExcerpt(
        'Use snake\\_case and 1\\. or \\*x\\*&#x20;&amp; &#169;',
      ),
    ).toBe('Use snake_case and 1. or *x* & ©');
  });

  it('keeps references it cannot decode, and decodes only once', () => {
    expect(markdownToExcerpt('&#99999999; &#x26;#169; &amp;amp;')).toBe(
      '&#99999999; &#169; &amp;',
    );
  });

  it('cuts long text on a word', () => {
    const excerpt = markdownToExcerpt('word '.repeat(100));

    expect(excerpt.length).toBeLessThanOrEqual(201);
    expect(excerpt).toMatch(/word…$/);
  });

  it('returns an empty string for an empty doc', () => {
    expect(markdownToExcerpt('\n\n', 'Title')).toBe('');
  });
});
