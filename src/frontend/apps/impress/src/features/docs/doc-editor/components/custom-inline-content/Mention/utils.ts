import { TextSelection } from '@tiptap/pm/state';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

/**
 * The search is replaced by the mention at the same position, which leaves the
 * cursor where it was, before the mention or even elsewhere in the doc. Put it
 * right after the mention so the user can keep typing.
 */
export const moveCursorAfterMention = (
  editor: DocsBlockNoteEditor,
  pos: number,
) => {
  editor.transact((tr) => {
    const mention = tr.doc.nodeAt(pos);

    if (!mention) {
      return;
    }

    tr.setSelection(
      TextSelection.create(tr.doc, pos + mention.nodeSize),
    ).scrollIntoView();
  });
};
