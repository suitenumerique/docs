import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingDividerPDF,
  blockMappingHeadingPDF,
  blockMappingParagraphPDF,
  blockMappingQuotePDF,
  blockMappingTablePDF,
} from './blocks-mapping';
import { DocsExporterPDF } from './types';

export const pdfDocsSchemaMappings: DocsExporterPDF['mappings'] = {
  ...pdfDefaultSchemaMappings,
  blockMapping: {
    ...pdfDefaultSchemaMappings.blockMapping,
    heading: blockMappingHeadingPDF,
    paragraph: blockMappingParagraphPDF,
    divider: blockMappingDividerPDF,
    quote: blockMappingQuotePDF,
    table: blockMappingTablePDF,
  },
};
