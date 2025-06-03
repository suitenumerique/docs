/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { Block, StyleSchema, StyledText } from '@blocknote/core';

export default function parseMarkdownWithLatex(blocks: Block[]): Block[] {
  return blocks.map((block) => {
    if (
      (block.type === 'paragraph' ||
        block.type == 'bulletListItem' ||
        block.type == 'numberedListItem' ||
        block.type == 'heading') &&
      block.content
    ) {
      const newContent: StyledText<StyleSchema>[] = [];
      let currentText = '';
      let isInLatex = false;
      let latexContent = '';

      // Process each content element
      for (let i = 0; i < block.content.length; i++) {
        const content = block.content[i];
        if (content.type === 'text') {
          // Process each character in the text content
          for (let j = 0; j < content.text.length; j++) {
            const char = content.text[j];
            if (char === '$') {
              if (isInLatex) {
                // End of LaTeX block
                if (currentText) {
                  newContent.push({
                    type: 'text',
                    text: currentText,
                    styles: content.styles,
                  });
                  currentText = '';
                }
                newContent.push({
                  type: 'inlineLatex',
                  props: {
                    formula: latexContent,
                  },
                });
                latexContent = '';
                isInLatex = false;
              } else {
                // Start of LaTeX block
                if (currentText) {
                  newContent.push({
                    type: 'text',
                    text: currentText,
                    styles: content.styles,
                  });
                  currentText = '';
                }
                isInLatex = true;
              }
            } else {
              if (isInLatex) {
                latexContent += char;
              } else {
                currentText += char;
              }
            }
          }
        } else {
          // Handle non-text content
          if (currentText) {
            newContent.push({
              type: 'text',
              text: currentText,
              styles: {},
            });
            currentText = '';
          }
          // Skip non-text content for now
          continue;
        }
      }

      // Add any remaining text
      if (currentText) {
        newContent.push({
          type: 'text',
          text: currentText,
          styles: {},
        });
      }

      // If we're still in a LaTeX block at the end, treat it as regular text
      if (isInLatex) {
        newContent.push({
          type: 'text',
          text: '$' + latexContent,
          styles: {},
        });
      }

      return {
        ...block,
        content: newContent,
      };
    }
    return block;
  });
}
