import { getAllDocChildren } from '@/docs/doc-tree/api/useDocChildren';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Replaces every `docChildren` block with a bullet list of interlinks to the
 * doc's sub-docs as they are at export time, since an exported file cannot
 * query them.
 */
export async function expandDocChildrenBlocks<T>(
  blocks: T[],
  docId: string,
): Promise<T[]> {
  const hasDocChildrenBlock = (items: unknown[]): boolean =>
    items.some(
      (block) =>
        isRecord(block) &&
        (block.type === 'docChildren' ||
          (Array.isArray(block.children) &&
            hasDocChildrenBlock(block.children))),
    );

  if (!hasDocChildrenBlock(blocks)) {
    return blocks;
  }

  // A failed lookup must fail the export: an empty list would silently drop
  // the sub-docs from a file the user thinks is complete.
  const children = await getAllDocChildren(docId);
  const links = children.map((child) => ({
    id: `doc-children-${child.id}`,
    type: 'bulletListItem',
    props: {
      backgroundColor: 'default',
      textColor: 'default',
      textAlignment: 'left',
    },
    content: [
      {
        type: 'interlinkingLinkInline',
        props: { docId: child.id, blockId: '', disabled: false, trigger: '/' },
      },
    ],
    children: [],
  }));

  const expand = (items: unknown[]): unknown[] =>
    items.flatMap((block) => {
      if (!isRecord(block)) {
        return [block];
      }
      if (block.type === 'docChildren') {
        return links;
      }
      return Array.isArray(block.children)
        ? [{ ...block, children: expand(block.children) }]
        : [block];
    });

  return expand(blocks) as T[];
}
