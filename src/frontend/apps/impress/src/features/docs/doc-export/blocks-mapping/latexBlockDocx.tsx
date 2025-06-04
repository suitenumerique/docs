import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

export const blockMappingLatexBlockDocx: DocsExporterDocx['mappings']['blockMapping']['latex'] =
  (block) => {
    return new Paragraph({
      spacing: { before: 10, after: 10 },
      children: [
        new TextRun({
          text: block.props.formula,
          break: 1,
        }),
      ],
    });
  };
