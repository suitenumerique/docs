import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';
import { docxBlockPropsToStyles } from '../utils';

export const blockMappingCalloutDocx: DocsExporterDocx['mappings']['blockMapping']['callout'] =
  (block, exporter) => {
    return new Paragraph({
      ...docxBlockPropsToStyles(block.props, exporter.options.colors),
      spacing: { before: 10, after: 10 },
      children: [
        new TextRun({
          text: ' ',
          break: 1,
        }),
        new TextRun('   ' + block.props.emoji + ' '),
        ...exporter.transformInlineContent(block.content),
        new TextRun({
          text: ' ',
          break: 1,
        }),
      ],
    });
  };
