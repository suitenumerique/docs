import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { useFindReplaceStore } from '../stores/useFindReplaceStore';

/**
 * Binds Cmd/Ctrl+F to open the in-editor Find & Replace panel instead of the
 * browser's native find bar.
 */
export const useFindReplaceShortcut = (
  editor: DocsBlockNoteEditor | undefined,
) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'f';

      if (!isFindShortcut) {
        return;
      }

      event.preventDefault();
      useFindReplaceStore.getState().open();
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editor]);
};
