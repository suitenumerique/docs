import { diffBlocks } from '../utils/diffBlocks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = any;

const makeBlock = (overrides: { id: string; [key: string]: unknown }): AnyBlock => ({
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text: '', styles: {} }],
  children: [],
  ...overrides,
});

const makeTextBlock = (id: string, text: string): AnyBlock =>
  makeBlock({
    id,
    content: [{ type: 'text', text, styles: {} }],
  });

describe('diffBlocks', () => {
  it('should return unchanged for identical blocks', () => {
    const blocks = [makeTextBlock('1', 'hello'), makeTextBlock('2', 'world')];
    const result = diffBlocks(blocks, blocks);

    expect(result).toHaveLength(2);
    expect(result[0].diffType).toBe('unchanged');
    expect(result[1].diffType).toBe('unchanged');
  });

  it('should detect an added block', () => {
    const base = [makeTextBlock('1', 'hello')];
    const target = [makeTextBlock('1', 'hello'), makeTextBlock('2', 'world')];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(2);
    expect(result[0].diffType).toBe('unchanged');
    expect(result[1].diffType).toBe('added');
  });

  it('should detect a removed block', () => {
    const base = [makeTextBlock('1', 'hello'), makeTextBlock('2', 'world')];
    const target = [makeTextBlock('1', 'hello')];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(2);
    expect(result[0].diffType).toBe('unchanged');
    expect(result[1].diffType).toBe('removed');
  });

  it('should detect modified text content', () => {
    const base = [makeTextBlock('1', 'hello world')];
    const target = [makeTextBlock('1', 'hello there')];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(1);
    expect(result[0].diffType).toBe('modified');
    expect(result[0].contentDiff).toBeDefined();
    expect(result[0].contentDiff!.length).toBeGreaterThan(0);

    const addedParts = result[0].contentDiff!.filter(
      (p) => p.diffType === 'added',
    );
    const removedParts = result[0].contentDiff!.filter(
      (p) => p.diffType === 'removed',
    );
    expect(addedParts.some((p) => p.text.includes('there'))).toBe(true);
    expect(removedParts.some((p) => p.text.includes('world'))).toBe(true);
  });

  it('should detect a block type change', () => {
    const base = [
      makeBlock({
        id: '1',
        type: 'paragraph',
        content: [{ type: 'text', text: 'title', styles: {} }],
      }),
    ];
    const target = [
      makeBlock({
        id: '1',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'title', styles: {} }],
      }),
    ];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(1);
    expect(result[0].diffType).toBe('modified');
    expect(result[0].propsChanged).toBe(true);
  });

  it('should handle empty block arrays', () => {
    expect(diffBlocks([], [])).toHaveLength(0);
    expect(diffBlocks([], [makeTextBlock('1', 'hi')])).toHaveLength(1);
    expect(diffBlocks([], [makeTextBlock('1', 'hi')])[0].diffType).toBe(
      'added',
    );
    expect(diffBlocks([makeTextBlock('1', 'hi')], [])).toHaveLength(1);
    expect(diffBlocks([makeTextBlock('1', 'hi')], [])[0].diffType).toBe(
      'removed',
    );
  });

  it('should handle nested children diffs', () => {
    const baseChild = makeTextBlock('c1', 'child text');
    const targetChild = makeTextBlock('c1', 'child modified');
    const base = [makeBlock({ id: '1', children: [baseChild] })];
    const target = [makeBlock({ id: '1', children: [targetChild] })];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(1);
    expect(result[0].diffType).toBe('modified');
    expect(result[0].childrenDiff).toBeDefined();
    expect(result[0].childrenDiff![0].diffType).toBe('modified');
  });

  it('should detect blocks with no text content as modified by props', () => {
    const base = [
      makeBlock({
        id: '1',
        type: 'image',
        props: { url: 'old.png' },
        content: undefined,
      }),
    ];
    const target = [
      makeBlock({
        id: '1',
        type: 'image',
        props: { url: 'new.png' },
        content: undefined,
      }),
    ];
    const result = diffBlocks(base, target);

    expect(result).toHaveLength(1);
    expect(result[0].diffType).toBe('modified');
    expect(result[0].propsChanged).toBe(true);
  });
});
