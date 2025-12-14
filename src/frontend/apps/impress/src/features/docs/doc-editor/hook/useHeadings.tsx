import { useEffect } from 'react';

import { useHeadingStore } from '../stores';
import { DocsBlockNoteEditor } from '../types';

export const useHeadings = (editor: DocsBlockNoteEditor) => {
  const { setHeadings, resetHeadings } = useHeadingStore();

  useEffect(() => {
    // Check if editor and its view are mounted before accessing document
    if (!editor) {
      return;
    }

    setHeadings(editor);

    let timeoutId: NodeJS.Timeout;
    const DEBOUNCE_DELAY = 500;
    const unsubscribe = editor?.onChange((_, context) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const blocksChanges = context.getChanges();

        if (!blocksChanges.length) {
          return;
        }

        const blockChanges = blocksChanges[0];

        if (
          blockChanges.type !== 'update' ||
          blockChanges.block.type !== 'heading'
        ) {
          return;
        }

        setHeadings(editor);
      }, DEBOUNCE_DELAY);
    });

    return () => {
      clearTimeout(timeoutId);
      resetHeadings();
      unsubscribe();
    };
  }, [editor, resetHeadings, setHeadings]);
};
