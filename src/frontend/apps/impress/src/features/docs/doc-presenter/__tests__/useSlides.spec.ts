import { describe, expect, test } from 'vitest';

import {
  getContentSlideIndexForBlock,
  getSlideTitle,
  splitBlocksIntoSlides,
} from '../hooks/useSlides';
import type { PresenterBlock } from '../types';

type TestBlock = PresenterBlock;

const block = (
  type: string,
  options: Partial<PresenterBlock> = {},
): TestBlock =>
  ({
    children: [],
    id: type,
    props: {},
    type,
    ...options,
  }) as PresenterBlock;

const textContent = (text: string) => ({
  styles: {},
  text,
  type: 'text' as const,
});

const para = (text = 'hello', id?: string): TestBlock =>
  block('paragraph', {
    content: text === '' ? [] : [textContent(text)],
    ...(id ? { id } : {}),
  });

const divider = (children: TestBlock[] = [], id?: string): TestBlock =>
  block('divider', { children, ...(id ? { id } : {}) });

const image = (): TestBlock => block('image', { props: { url: 'x' } });

const quote = (text: string): TestBlock =>
  block('quote', { content: [textContent(text)] });

describe('splitBlocksIntoSlides', () => {
  test('no divider yields one slide', () => {
    const result = splitBlocksIntoSlides([para('a'), para('b')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  test('one divider yields two slides', () => {
    const result = splitBlocksIntoSlides([para('a'), divider(), para('b')]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1);
    expect(result[1]).toHaveLength(1);
  });

  test('leading divider does not produce an empty slide', () => {
    const result = splitBlocksIntoSlides([divider(), para('a')]);
    expect(result).toHaveLength(1);
  });

  test('trailing divider does not produce an empty slide', () => {
    const result = splitBlocksIntoSlides([para('a'), divider()]);
    expect(result).toHaveLength(1);
  });

  test('consecutive dividers do not produce empty slides', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider(),
      divider(),
      divider(),
      para('b'),
    ]);
    expect(result).toHaveLength(2);
  });

  test('empty doc yields one empty slide', () => {
    const result = splitBlocksIntoSlides([]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(0);
  });

  test('divider-only doc yields one empty slide', () => {
    const result = splitBlocksIntoSlides([divider(), divider()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(0);
  });

  test('leading empty paragraphs after dividers are removed', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider(),
      para(''),
      para('   '),
      para('b'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'a' }] });
    expect(result[1]).toHaveLength(1);
    expect(result[1][0]).toMatchObject({ content: [{ text: 'b' }] });
  });

  test('empty paragraphs after content are preserved as intentional spacing', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider(),
      para('b'),
      para(''),
      para('   '),
    ]);
    expect(result).toHaveLength(2);
    expect(result[1]).toHaveLength(3);
    expect(result[1][0]).toMatchObject({ content: [{ text: 'b' }] });
  });

  test('trailing empty paragraphs before dividers are removed', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      para(''),
      para('   '),
      divider(),
      para('b'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'a' }] });
    expect(result[1][0]).toMatchObject({ content: [{ text: 'b' }] });
  });

  test('empty paragraphs between content blocks before a divider are preserved', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      para(''),
      para('b'),
      divider(),
      para('c'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(3);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'a' }] });
    expect(result[0][2]).toMatchObject({ content: [{ text: 'b' }] });
  });

  test('leading empty children under structural dividers are removed', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider([para(''), para('   '), para('b')]),
    ]);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject([
      { type: 'divider', children: [{ content: [{ text: 'b' }] }] },
    ]);
  });

  test('trailing empty children under structural dividers are removed before dividers', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider([para('b'), para(''), para('   ')]),
      divider(),
      para('c'),
    ]);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject([
      { type: 'divider', children: [{ content: [{ text: 'b' }] }] },
    ]);
    expect(result[2][0]).toMatchObject({ content: [{ text: 'c' }] });
  });

  test('blocks within a group are kept verbatim, empty or not', () => {
    const result = splitBlocksIntoSlides([para(''), para('hi'), para('   ')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
    expect(result[0][1]).toMatchObject({ content: [{ text: 'hi' }] });
  });

  test('image-only group is kept', () => {
    const result = splitBlocksIntoSlides([para('a'), divider(), image()]);
    expect(result).toHaveLength(2);
    expect(result[1]).toHaveLength(1);
  });

  test('children nested under dividers keep their nesting in the following slides', () => {
    const hello = para('Hello');
    const test2 = para('Test 2');
    const after = quote('dfsqdqsdqs');
    const firstDivider = divider([hello]);
    const secondDivider = divider([test2]);
    const result = splitBlocksIntoSlides([
      para('Test 1'),
      firstDivider,
      secondDivider,
      after,
      para('fsdf'),
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject([{ content: [{ text: 'Test 1' }] }]);
    expect(result[1]).toEqual([firstDivider]);
    expect(result[2]).toMatchObject([
      { type: 'divider', children: [{ content: [{ text: 'Test 2' }] }] },
      { type: 'quote', content: [{ text: 'dfsqdqsdqs' }] },
      { content: [{ text: 'fsdf' }] },
    ]);
  });
});

describe('getContentSlideIndexForBlock', () => {
  test('returns the slide containing a regular block', () => {
    expect(
      getContentSlideIndexForBlock(
        [para('a', 'a'), divider(), para('b', 'b'), para('c', 'c')],
        'c',
      ),
    ).toBe(1);
  });

  test('returns the following slide for a divider', () => {
    expect(
      getContentSlideIndexForBlock(
        [para('a', 'a'), divider(undefined, 'divider'), para('b', 'b')],
        'divider',
      ),
    ).toBe(1);
  });

  test('returns the first non-empty following slide for consecutive dividers', () => {
    expect(
      getContentSlideIndexForBlock(
        [
          para('a', 'a'),
          divider(undefined, 'first-divider'),
          divider(undefined, 'second-divider'),
          para('b', 'b'),
        ],
        'first-divider',
      ),
    ).toBe(1);
  });

  test('skips empty-only slides after dividers when mapping divider links', () => {
    expect(
      getContentSlideIndexForBlock(
        [
          para('a', 'a'),
          divider(undefined, 'first-divider'),
          para('', 'empty-after-divider'),
          divider(undefined, 'second-divider'),
          para('b', 'b'),
        ],
        'first-divider',
      ),
    ).toBe(1);
  });

  test('maps a stripped empty block after a divider to the following content slide', () => {
    expect(
      getContentSlideIndexForBlock(
        [
          para('a', 'a'),
          divider(undefined, 'divider'),
          para('', 'empty-after-divider'),
          para('b', 'b'),
        ],
        'empty-after-divider',
      ),
    ).toBe(1);
  });

  test('maps a stripped empty block before a divider to the previous content slide', () => {
    expect(
      getContentSlideIndexForBlock(
        [
          para('a', 'a'),
          para('', 'empty-before-divider'),
          divider(undefined, 'divider'),
          para('b', 'b'),
        ],
        'empty-before-divider',
      ),
    ).toBe(0);
  });

  test('maps a stripped empty-only slide to the next rendered content slide', () => {
    expect(
      getContentSlideIndexForBlock(
        [
          para('a', 'a'),
          divider(undefined, 'first-divider'),
          para('', 'empty-between-dividers'),
          divider(undefined, 'second-divider'),
          para('b', 'b'),
        ],
        'empty-between-dividers',
      ),
    ).toBe(1);
  });

  test('maps a leading divider to the first content slide', () => {
    expect(
      getContentSlideIndexForBlock(
        [divider(undefined, 'divider'), para('a', 'a')],
        'divider',
      ),
    ).toBe(0);
  });

  test('maps a trailing divider to the last rendered content slide', () => {
    expect(
      getContentSlideIndexForBlock(
        [para('a', 'a'), divider(undefined, 'divider')],
        'divider',
      ),
    ).toBe(0);
  });

  test('finds blocks nested under a structural divider', () => {
    expect(
      getContentSlideIndexForBlock(
        [para('a', 'a'), divider([para('nested', 'nested')], 'divider')],
        'nested',
      ),
    ).toBe(1);
  });

  test('returns the first content slide when the block is missing', () => {
    expect(
      getContentSlideIndexForBlock(
        [para('a', 'a'), divider(), para('b', 'b')],
        'x',
      ),
    ).toBe(0);
  });
});

const heading = (text: string): TestBlock =>
  block('heading', { content: [textContent(text)] });

describe('getSlideTitle', () => {
  test('returns text from the first heading', () => {
    expect(getSlideTitle([para('intro'), heading('My Title')])).toBe(
      'My Title',
    );
  });

  test('falls back to first paragraph when no heading', () => {
    expect(getSlideTitle([para('fallback text')])).toBe('fallback text');
  });

  test('returns empty string for empty slide', () => {
    expect(getSlideTitle([])).toBe('');
  });

  test('returns empty string when all blocks have empty content', () => {
    expect(getSlideTitle([para(''), image()])).toBe('');
  });

  test('skips whitespace-only blocks and picks the first with text', () => {
    expect(getSlideTitle([para('   '), para('real text')])).toBe('real text');
  });

  test('prefers heading over paragraph even when paragraph comes first', () => {
    expect(getSlideTitle([para('first'), heading('Title')])).toBe('Title');
  });

  test('extracts text from nested inline content (e.g. links)', () => {
    const linkBlock = block('paragraph', {
      content: [
        textContent('Visit '),
        {
          content: [textContent('our site')],
          href: 'https://example.com',
          type: 'link',
        },
      ],
    });
    expect(getSlideTitle([linkBlock])).toBe('Visit our site');
  });

  test('handles blocks without content property', () => {
    expect(getSlideTitle([divider(), para('after')])).toBe('after');
  });

  test('extracts text from blocks nested under structural dividers', () => {
    expect(getSlideTitle([divider([para('nested text')])])).toBe('nested text');
  });

  test('trims leading and trailing whitespace', () => {
    expect(getSlideTitle([para('  spaced  ')])).toBe('spaced');
  });
});
