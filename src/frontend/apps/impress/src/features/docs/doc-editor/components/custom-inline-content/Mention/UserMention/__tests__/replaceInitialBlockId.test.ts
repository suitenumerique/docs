import { describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { replaceInitialBlockId } from '../replaceInitialBlockId';

type FakeNode = {
  type: { isInGroup: (group: string) => boolean };
  attrs: { id?: string; textColor?: string };
};

const createNode = (isBlock: boolean, id?: string): FakeNode => ({
  type: { isInGroup: (group) => isBlock && group === 'bnBlock' },
  attrs: { id, textColor: 'default' },
});

const createEditor = (nodes: FakeNode[]) => {
  const setNodeMarkup = vi.fn();
  const editor = {
    transact: (callback: (tr: unknown) => unknown) =>
      callback({
        doc: {
          descendants: (
            visit: (node: FakeNode, pos: number) => boolean | void,
          ) => {
            nodes.forEach((node, pos) => visit(node, pos));
          },
        },
        setNodeMarkup,
      }),
  } as unknown as DocsBlockNoteEditor;

  return { editor, setNodeMarkup };
};

describe('replaceInitialBlockId', () => {
  it('gives a uuid to the block with the initial id and returns it', () => {
    const { editor, setNodeMarkup } = createEditor([
      createNode(false),
      createNode(true, 'initialBlockId'),
      createNode(true, 'other-block'),
    ]);

    const newId = replaceInitialBlockId(editor);

    expect(newId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(setNodeMarkup).toHaveBeenCalledTimes(1);
    expect(setNodeMarkup).toHaveBeenCalledWith(1, undefined, {
      id: newId,
      textColor: 'default',
    });
  });

  it('ignores a node which is not a block', () => {
    const { editor, setNodeMarkup } = createEditor([
      createNode(false, 'initialBlockId'),
    ]);

    expect(replaceInitialBlockId(editor)).toBeUndefined();
    expect(setNodeMarkup).not.toHaveBeenCalled();
  });

  it('returns undefined when no block has the initial id', () => {
    const { editor, setNodeMarkup } = createEditor([
      createNode(true, 'other-block'),
    ]);

    expect(replaceInitialBlockId(editor)).toBeUndefined();
    expect(setNodeMarkup).not.toHaveBeenCalled();
  });
});
