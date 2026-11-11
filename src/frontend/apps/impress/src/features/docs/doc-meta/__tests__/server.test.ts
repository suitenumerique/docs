import { describe, expect, it } from 'vitest';

import { markdownToExcerpt } from '../server';

describe('markdownToExcerpt', () => {
  it('keeps the text and drops the markdown', () => {
    expect(
      markdownToExcerpt(
        '# Plan\n\nSee **the** [roadmap](https://x.test) and `code`.\n\n> A quote\n\n* one\n* [x] two\n1. three\n\n| a | b |\n| --- | --- |\n| c | d |\n',
      ),
    ).toBe(
      'Plan. See the roadmap and code. A quote. one. two. three. a b. c d',
    );
  });

  it('leaves out a first line repeating the title', () => {
    expect(markdownToExcerpt('# Plan\n\nThe text.', 'Plan')).toBe('The text.');
  });

  it('leaves out a first line with the words of the title in another order', () => {
    expect(
      markdownToExcerpt(
        '# Privacy Policy: ReadFollow\n\nLast updated: today\n\nReadFollow reads text',
        'ReadFollow: Privacy Policy',
      ),
    ).toBe('Last updated: today. ReadFollow reads text');
  });

  it('keeps a first line that only shares some words with the title', () => {
    expect(markdownToExcerpt('# Plan B\n\nThe text', 'Plan')).toBe(
      'Plan B. The text',
    );
  });

  it('ends a line without punctuation before the next one', () => {
    expect(
      markdownToExcerpt('# Setup\n\nInstall it!\n\n* "Quoted."\n* last'),
    ).toBe('Setup. Install it! "Quoted." last');
  });

  it('adds no full stop after other punctuation', () => {
    expect(
      markdownToExcerpt('* “Done.”\n* apples,\n* أولاً،\n* «سلام.»\n* end'),
    ).toBe('“Done.” apples, أولاً، «سلام.» end');
  });

  it('ends a line closing on a bracket, a sign or a quote', () => {
    expect(
      markdownToExcerpt('# Plan (beta)\n\n* 50%\n* «שלום»\n\nInstall it'),
    ).toBe('Plan (beta). 50%. «שלום». Install it');
  });

  it('keeps a quote wrapped over lines in one sentence', () => {
    expect(markdownToExcerpt('> This keeps\n> going.\n\nNext')).toBe(
      'This keeps going. Next',
    );
  });

  it('ends a heading or list item inside a quote', () => {
    expect(
      markdownToExcerpt('> # Notes\n> First point\n> * one\n> * two'),
    ).toBe('Notes. First point. one. two');
  });

  it('keeps an escaped pipe in a paragraph', () => {
    expect(markdownToExcerpt('Choose a\\|b for\nthe mode')).toBe(
      'Choose a|b for the mode',
    );
  });

  it('reads triple backticks inside a line as text', () => {
    expect(markdownToExcerpt('```npm i``` then run it\n\nNext')).toBe(
      'npm i then run it. Next',
    );
  });

  it('closes a code block only on a fence as long as its opening', () => {
    expect(
      markdownToExcerpt('Intro\n\n````\n```\ncode\n```\n````\n\nAfter'),
    ).toBe('Intro. After');
  });

  it('keeps a paragraph with a line break in one sentence', () => {
    expect(
      markdownToExcerpt('This keeps\ngoing, and\\\nstill goes.\n\nNext'),
    ).toBe('This keeps going, and still goes. Next');
  });

  it('leaves out code blocks', () => {
    expect(
      markdownToExcerpt(
        '# Setup\n\n```bash\nnpm i\nnpm start\n```\n\nThen open it',
      ),
    ).toBe('Setup. Then open it');
  });

  it('matches the title whatever the diacritics', () => {
    expect(markdownToExcerpt('# עולם שָׁלוֹם\n\nטקסט', 'שלום עולם')).toBe(
      'טקסט',
    );
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
