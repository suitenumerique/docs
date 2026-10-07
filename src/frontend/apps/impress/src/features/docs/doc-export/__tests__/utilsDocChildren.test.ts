import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllDocChildren } from '@/docs/doc-tree/api/useDocChildren';

import { expandDocChildrenBlocks } from '../utils_doc_children';

vi.mock('@/docs/doc-tree/api/useDocChildren', () => ({
  getAllDocChildren: vi.fn(),
}));

const linkTo = (docId: string) => ({
  id: `doc-children-${docId}`,
  type: 'bulletListItem',
  props: {
    backgroundColor: 'default',
    textColor: 'default',
    textAlignment: 'left',
  },
  content: [
    {
      type: 'interlinkingLinkInline',
      props: { docId, blockId: '', disabled: false, trigger: '/' },
    },
  ],
  children: [],
});

describe('expandDocChildrenBlocks', () => {
  beforeEach(() => {
    vi.mocked(getAllDocChildren).mockReset();
  });

  it('returns the blocks untouched without fetching when there is no docChildren block', async () => {
    const blocks = [{ id: 'p1', type: 'paragraph', children: [] }];

    await expect(expandDocChildrenBlocks(blocks, 'parent')).resolves.toBe(
      blocks,
    );
    expect(getAllDocChildren).not.toHaveBeenCalled();
  });

  it('replaces docChildren blocks, nested ones included, with links to the sub-docs', async () => {
    vi.mocked(getAllDocChildren).mockResolvedValue([
      { id: 'child-1' },
      { id: 'child-2' },
    ] as Awaited<ReturnType<typeof getAllDocChildren>>);

    const blocks = [
      { id: 'p1', type: 'paragraph', children: [] },
      { id: 'c1', type: 'docChildren', children: [] },
      {
        id: 'col',
        type: 'column',
        children: [{ id: 'c2', type: 'docChildren', children: [] }],
      },
    ];

    const result = await expandDocChildrenBlocks(blocks, 'parent');

    expect(getAllDocChildren).toHaveBeenCalledTimes(1);
    expect(getAllDocChildren).toHaveBeenCalledWith('parent');
    expect(result).toEqual([
      blocks[0],
      linkTo('child-1'),
      linkTo('child-2'),
      {
        id: 'col',
        type: 'column',
        children: [linkTo('child-1'), linkTo('child-2')],
      },
    ]);
  });

  it('drops the block when the sub-docs cannot be fetched', async () => {
    vi.mocked(getAllDocChildren).mockRejectedValue(new Error('403'));

    const result = await expandDocChildrenBlocks(
      [{ id: 'c1', type: 'docChildren', children: [] }],
      'parent',
    );

    expect(result).toEqual([]);
  });
});
