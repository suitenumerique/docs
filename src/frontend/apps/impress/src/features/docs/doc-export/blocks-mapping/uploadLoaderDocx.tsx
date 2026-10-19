import { Paragraph, TextRun } from 'docx';

import { type DocsExporterDocx } from '../types';

export const blockMappingUploadLoaderDocx: DocsExporterDocx['mappings']['blockMapping']['uploadLoader'] =
  (block) => {
    return new Paragraph({
      children: [
        new TextRun(block.props.type === 'loading' ? '⏳' : '⚠️'),
        new TextRun(' '),
        new TextRun(block.props.information),
      ],
    });
  };
