import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

/**
 * Id of the block containing the given position of the document.
 * It is the anchor of a mention, the email links to it.
 */
export const getBlockIdAtPos = (
  editor: DocsBlockNoteEditor,
  pos: number,
): string | undefined =>
  editor.transact((tr) => {
    const $pos = tr.doc.resolve(pos);

    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);

      if (node.type.isInGroup('bnBlock')) {
        return node.attrs.id as string;
      }
    }

    return undefined;
  });
