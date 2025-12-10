import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '../types';

export const useShortcuts = (
  editor: DocsBlockNoteEditor,
  el: HTMLDivElement | null,
) => {
  useEffect(() => {
    // Check if editor and its view are mounted
    if (!editor || !editor._tiptapEditor?.view?.dom || !el) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '@' && editor?.isFocused()) {
        const selection = window.getSelection();
        const previousChar =
          selection?.anchorNode?.textContent?.charAt(
            selection.anchorOffset - 1,
          ) || '';

        if (![' ', ''].includes(previousChar)) {
          return;
        }

        event.preventDefault();
        editor.insertInlineContent([
          {
            type: 'interlinkingSearchInline',
            props: {
              disabled: false,
              trigger: '@',
            },
          },
        ]);
      }
    };

    el.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, el]);
};
