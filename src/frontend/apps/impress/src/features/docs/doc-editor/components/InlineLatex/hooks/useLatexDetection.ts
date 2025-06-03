import { useEffect } from 'react';

import { DocsBlockNoteEditor } from '../../../types';

export const useLatexDetection = (editor: DocsBlockNoteEditor) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const selectedText = editor.getSelectedText();
      if (selectedText && e.key === '$') {
        e.preventDefault();

        // Insert the LaTeX inline element
        editor.insertInlineContent([
          {
            type: 'inlineLatex' as const,
            props: {
              formula: selectedText,
            },
          },
        ]);
      }
    };

    editor.domElement?.addEventListener('keydown', handleKeyDown);
    return () => {
      editor.domElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);
};
