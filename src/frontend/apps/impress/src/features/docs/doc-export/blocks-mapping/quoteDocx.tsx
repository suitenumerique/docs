import { Paragraph } from 'docx';

import { DocsExporterDocx } from '../types';
import { docxBlockPropsToStyles } from '../utils';

export const blockMappingQuoteDocx: DocsExporterDocx['mappings']['blockMapping']['quote'] =
  (block, exporter) => {
    if (Array.isArray(block.content)) {
      block.content.forEach((content) => {
        if (content.type === 'text') {
          content.styles = {
            ...content.styles,
            italic: true,
            textColor: 'gray',
          };
        }
      });
    }

    return new Paragraph({
      ...docxBlockPropsToStyles(block.props, exporter.options.colors),
      spacing: { before: 10, after: 10 },
      border: {
        left: {
          color: '#cecece',
          space: 4,
          style: 'thick',
        },
      },
      style: 'Normal',
      children: exporter.transformInlineContent(block.content),
    });
  };
