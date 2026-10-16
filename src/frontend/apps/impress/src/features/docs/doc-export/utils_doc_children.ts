import type { QueryClient } from '@tanstack/react-query';

import { KEY_DOC } from '@/docs/doc-management/api/useDoc';
import { getAllDocChildren } from '@/docs/doc-tree/api/useDocChildren';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Replaces every `docChildren` block with one paragraph per sub-doc holding an
 * interlink to it, as they are at export time, since an exported file cannot
 * query them. Paragraphs rather than list items, so the file shows no bullets,
 * like the editor.
 *
 * The Markdown and HTML exports render each interlink once, synchronously, so
 * the sub-docs are put in the query cache: an uncached one would come out as a
 * loader instead of its title.
 */
export async function expandDocChildrenBlocks<T>(
  blocks: T[],
  docId: string,
  queryClient: QueryClient,
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
  children.forEach((child) =>
    queryClient.setQueryData([KEY_DOC, { id: child.id }], child),
  );
  const links = children.map((child) => ({
    id: `doc-children-${child.id}`,
    type: 'paragraph',
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
