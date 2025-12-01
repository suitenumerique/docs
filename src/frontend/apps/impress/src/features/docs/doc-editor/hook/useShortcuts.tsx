import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '../types';

export const useShortcuts = (
  editor: DocsBlockNoteEditor,
  el: HTMLDivElement | null,
) => {
  useEffect(() => {
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

    if (!el) {
      return;
    }

    el.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, el]);
};
