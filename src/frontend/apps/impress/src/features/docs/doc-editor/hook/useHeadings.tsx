import { useEffect } from 'react';

import { useHeadingStore } from '../stores';
import { DocsBlockNoteEditor } from '../types';

export const useHeadings = (editor: DocsBlockNoteEditor) => {
  const { setHeadings, resetHeadings } = useHeadingStore();

  useEffect(() => {
    setHeadings(editor);

    const unsubscribe = editor?.onChange(() => {
      setHeadings(editor);
    });

    return () => {
      resetHeadings();
      unsubscribe();
    };
  }, [editor, resetHeadings, setHeadings]);
};
