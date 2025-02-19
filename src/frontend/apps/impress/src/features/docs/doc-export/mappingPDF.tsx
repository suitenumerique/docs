import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingHeadingPDF,
  blockMappingParagraphPDF,
  blockMappingTablePDF,
} from './blocks-mapping';
import { DocsExporterPDF } from './types';

export const pdfDocsSchemaMappings: DocsExporterPDF['mappings'] = {
  ...pdfDefaultSchemaMappings,
  blockMapping: {
    ...pdfDefaultSchemaMappings.blockMapping,
    heading: blockMappingHeadingPDF,
    paragraph: blockMappingParagraphPDF,
    table: blockMappingTablePDF,
  },
};
