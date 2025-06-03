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
      } else if (e.key === '$') {
        const textCursorPosition = editor.getTextCursorPosition();

        console.log(textCursorPosition);

        const currentBlock = textCursorPosition.block;
        console.log(currentBlock);
        // if (lastKeyRef.current === '$') {
        //   // Two consecutive $ signs detected
        //   e.preventDefault();
        //   const textCursorPosition = editor.getTextCursorPosition();
        //   const currentBlock = textCursorPosition.block;
        //   if (
        //     currentBlock?.type === 'paragraph' &&
        //     currentBlock.content.length > 0
        //   ) {
        //     const lastText =
        //       currentBlock.content[currentBlock.content.length - 1];
        //     if (lastText.type === 'text' && lastText.text.endsWith('$')) {
        //       const newText = lastText.text.slice(0, -1);
        //       const newBlock = {
        //         ...currentBlock,
        //         content: [
        //           ...currentBlock.content.slice(0, -1),
        //           {
        //             type: 'text',
        //             text: newText,
        //           },
        //           {
        //             type: 'inlineLatex' as const,
        //             props: {
        //               formula: '',
        //               catchFocus: true,
        //             },
        //           },
        //         ],
        //       };
        //       editor.updateBlock(currentBlock, newBlock);
        //     }
        //   }
        //   // Reset the last key
        //   lastKeyRef.current = '';
        // } else {
        //   // First $ sign
        //   lastKeyRef.current = '$';
        // }
      }
      // else {
      //   // Reset the last key if any other key is pressed
      //   lastKeyRef.current = '';
      // }
    };

    editor.domElement?.addEventListener('keydown', handleKeyDown);
    return () => {
      editor.domElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);
};
