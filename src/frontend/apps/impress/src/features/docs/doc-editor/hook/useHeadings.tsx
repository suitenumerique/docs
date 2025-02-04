import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '../components/BlockNoteEditor';
import { useHeadingStore } from '../stores';

export const useHeadings = (editor: DocsBlockNoteEditor) => {
  const { setHeadings, resetHeadings } = useHeadingStore();

  useEffect(() => {
    setHeadings(editor);

    editor?.onEditorContentChange(() => {
      setHeadings(editor);
    });

    return () => {
      resetHeadings();
    };
  }, [editor, resetHeadings, setHeadings]);
};
