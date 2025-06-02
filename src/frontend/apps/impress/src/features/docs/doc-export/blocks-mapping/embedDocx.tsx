import { Paragraph } from 'docx';

import { DocsExporterDocx } from '../types';

export const blockMappingEmbedDocx: DocsExporterDocx['mappings']['blockMapping']['embed'] =
  () => {
    return new Paragraph({});
  };
