import { Paragraph, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

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
