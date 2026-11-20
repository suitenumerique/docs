import { createExtension, getBlockInfoFromSelection } from '@blocknote/core';
import { AllSelection, EditorState, TextSelection } from '@tiptap/pm/state';

/**
 * Whether Mod-a should leave the selection to BlockNote, which first selects
 * the content of the current block: the caret or the selection is inside a
 * block that has text, and does not cover that text whole yet.
 */
const selectsBlockFirst = (state: EditorState) => {
  const { doc, selection } = state;
  const info = getBlockInfoFromSelection(state);
  if (!info.hasContent) {
    return false;
  }

  const blockText = TextSelection.between(
    doc.resolve(info.contentStart),
    doc.resolve(info.contentEnd),
  );
  if (
    blockText.empty ||
    blockText.from < info.contentStart ||
    blockText.to > info.contentEnd
  ) {
    return false;
  }

  const isInsideBlockText =
    selection.from >= blockText.from && selection.to <= blockText.to;
  const isWholeBlockText =
    selection.from === blockText.from && selection.to === blockText.to;

  return isInsideBlockText && !isWholeBlockText;
};

/**
 * Mod-a selects the content of the current block, then the whole document.
 *
 * BlockNote selects the whole document with a TextSelection, which cannot
 * start before or end after a block without text (image, video, embed...):
 * such a block was left out of the selection, and its end landed in the
 * last text of the document, scrolling the page there.
 * An AllSelection covers every block and keeps the scroll position.
 */
export const SelectAllShortcut = createExtension({
  key: 'docsSelectAll',
  keyboardShortcuts: {
    'Mod-a': ({ editor }) => {
      const view = editor.prosemirrorView;
      if (!view || selectsBlockFirst(view.state)) {
        return false;
      }

      view.dispatch(
        view.state.tr.setSelection(new AllSelection(view.state.doc)),
      );
      return true;
    },
  },
});
