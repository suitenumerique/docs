import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

export const blockMappingMermaidBlockDocx: DocsExporterDocx['mappings']['blockMapping']['mermaid'] =
  (block) => {
    return new Paragraph({
      spacing: { before: 10, after: 10 },
      children: [
        new TextRun({
          text: 'This block is not supported in Docx',
          break: 1,
        }),
      ],
    });
  };
