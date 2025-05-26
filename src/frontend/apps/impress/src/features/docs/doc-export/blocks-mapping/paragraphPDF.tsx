import { Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingParagraphPDF: DocsExporterPDF['mappings']['blockMapping']['paragraph'] =
  (block, exporter) => {
    /**
     * Break line in the editor are not rendered in the PDF
     * By adding a space if the block is empty we ensure that the block is rendered
     */
    if (Array.isArray(block.content)) {
      block.content.forEach((content) => {
        if (content.type === 'text' && !content.text) {
          content.text = ' ';
        }
      });

      if (!block.content.length) {
        block.content.push({
          styles: {},
          text: ' ',
          type: 'text',
        });
      }
    }
    return (
      <Text key={block.id}>
        {exporter.transformInlineContent(block.content)}
      </Text>
    );
  };
