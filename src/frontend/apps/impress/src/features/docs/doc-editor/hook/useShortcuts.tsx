import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '../types';

export const useShortcuts = (editor: DocsBlockNoteEditor) => {
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

    // Attach the event listener to the document instead of the window
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);
};
