import { describe, expect, it } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { getBlockIdAtPos } from '../getBlockIdAtPos';

type FakeNode = {
  type: { isInGroup: (group: string) => boolean };
  attrs: { id?: string };
};

const createNode = (isBlock: boolean, id?: string): FakeNode => ({
  type: { isInGroup: (group) => isBlock && group === 'bnBlock' },
  attrs: { id },
});

const createEditor = (nodes: FakeNode[]) =>
  ({
    transact: (callback: (tr: unknown) => unknown) =>
      callback({
        doc: {
          resolve: () => ({
            depth: nodes.length - 1,
            node: (depth: number) => nodes[depth],
          }),
        },
      }),
  }) as unknown as DocsBlockNoteEditor;

describe('getBlockIdAtPos', () => {
  it('returns the id of the closest block around the position', () => {
    const editor = createEditor([
      createNode(false),
      createNode(true, 'outer-block'),
      createNode(true, 'inner-block'),
      createNode(false),
    ]);

    expect(getBlockIdAtPos(editor, 5)).toBe('inner-block');
  });

  it('returns undefined when the position is not in a block', () => {
    const editor = createEditor([createNode(false), createNode(false)]);

    expect(getBlockIdAtPos(editor, 0)).toBeUndefined();
  });
});
