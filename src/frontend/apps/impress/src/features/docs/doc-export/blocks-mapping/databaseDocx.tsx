import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';
import { docxBlockPropsToStyles } from '../utils';

export const blockMappingDatabaseDocx: DocsExporterDocx['mappings']['blockMapping']['database'] =
  (block, exporter) => {
    return new Paragraph({
      ...docxBlockPropsToStyles({}, exporter.options.colors),
      spacing: { before: 10, after: 10 },
      children: [
        new TextRun({
          text: ' ',
          break: 1,
        }),
        new TextRun({
          text: ' ',
          break: 1,
        }),
      ],
    });
  };
