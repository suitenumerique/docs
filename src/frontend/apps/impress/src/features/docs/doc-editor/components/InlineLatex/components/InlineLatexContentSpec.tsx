import { DefaultReactSuggestionItem } from '@blocknote/react';

import { DocsBlockNoteEditor } from '../../../types';

// The Latex inline content.
export default function getInlineLatexMenuItems(
  editor: DocsBlockNoteEditor,
  query: string,
): DefaultReactSuggestionItem[] {
  const items = ['Insert LaTeX...'];

  return items.map((user) => ({
    title: user,
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: 'inlineLatex',
          props: {
            formula: query,
            catchFocus: true,
          },
        },
      ]);
    },
  }));
}
