import { describe, expect, test } from 'vitest';

import { isEmptyBlock, splitBlocksIntoSlides } from '../hooks/useSlides';

const para = (text = 'hello') => ({
  type: 'paragraph',
  content: text === '' ? [] : [{ type: 'text', text }],
});
const heading = (text = 'Title', level = 1) => ({
  type: 'heading',
  content: [{ type: 'text', text }],
  props: { level },
});
const divider = () => ({ type: 'divider' });
const image = () => ({ type: 'image', props: { url: 'x' } });

describe('isEmptyBlock', () => {
  test('empty paragraph (no content array entries) is empty', () => {
    expect(isEmptyBlock(para(''))).toBe(true);
  });

  test('whitespace-only paragraph is empty', () => {
    expect(isEmptyBlock(para('   '))).toBe(true);
  });

  test('paragraph with text is not empty', () => {
    expect(isEmptyBlock(para('hi'))).toBe(false);
  });

  test('heading with whitespace is empty', () => {
    expect(isEmptyBlock(heading('  '))).toBe(true);
  });

  test('image is never empty', () => {
    expect(isEmptyBlock(image() as any)).toBe(false);
  });

  test('divider is not "empty" (it is filtered separately)', () => {
    expect(isEmptyBlock(divider() as any)).toBe(false);
  });

  test('block with children is not empty', () => {
    const b = { type: 'paragraph', content: [], children: [para()] };
    expect(isEmptyBlock(b as any)).toBe(false);
  });
});

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

  test('group of only empty paragraphs is dropped', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider(),
      para(''),
      para('   '),
      divider(),
      para('b'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'a' }] });
    expect(result[1][0]).toMatchObject({ content: [{ text: 'b' }] });
  });

  test('group with one empty + one non-empty paragraph keeps only the non-empty', () => {
    const result = splitBlocksIntoSlides([para(''), para('hi'), para('   ')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'hi' }] });
  });

  test('image-only group is kept', () => {
    const result = splitBlocksIntoSlides([para('a'), divider(), image()]);
    expect(result).toHaveLength(2);
    expect(result[1]).toHaveLength(1);
  });

  test('heading with whitespace is filtered', () => {
    const result = splitBlocksIntoSlides([heading('  '), para('body')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toMatchObject({ type: 'paragraph' });
  });
});
