import { useEffect, useRef } from 'react';

import { DocsBlockNoteEditor } from '../../../types';

export const useLatexDetection = (editor: DocsBlockNoteEditor) => {
  // const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const selectedText = editor.getSelectedText();

      if (selectedText && e.key === '$') {
        // Handle selected text first
        e.preventDefault();

        // Insert the LaTeX inline element
        editor.insertInlineContent([
          {
            type: 'inlineLatex' as const,
            props: {
              formula: selectedText,
              catchFocus: true,
            },
          },
        ]);

        // Reset the last key
        // lastKeyRef.current = '';
      }
    };

    editor.domElement?.addEventListener('keydown', handleKeyDown);
    return () => {
      editor.domElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);
};
