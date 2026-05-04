import { describe, expect, test } from 'vitest';

import { splitBlocksIntoSlides } from '../hooks/useSlides';

const para = (text = 'hello') => ({
  type: 'paragraph',
  content: text === '' ? [] : [{ type: 'text', text }],
});
const divider = () => ({ type: 'divider' });
const image = () => ({ type: 'image', props: { url: 'x' } });

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

  test('empty paragraphs are preserved as intentional spacing', () => {
    const result = splitBlocksIntoSlides([
      para('a'),
      divider(),
      para(''),
      para('   '),
      divider(),
      para('b'),
    ]);
    expect(result).toHaveLength(3);
    expect(result[0][0]).toMatchObject({ content: [{ text: 'a' }] });
    expect(result[1]).toHaveLength(2);
    expect(result[2][0]).toMatchObject({ content: [{ text: 'b' }] });
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
});
