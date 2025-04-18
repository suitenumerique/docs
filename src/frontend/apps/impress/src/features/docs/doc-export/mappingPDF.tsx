import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingCalloutPDF,
  blockMappingDividerPDF,
  blockMappingHeadingPDF,
  blockMappingImagePDF,
  blockMappingParagraphPDF,
  blockMappingQuotePDF,
  blockMappingTablePDF,
} from './blocks-mapping';
import { DocsExporterPDF } from './types';

export const pdfDocsSchemaMappings: DocsExporterPDF['mappings'] = {
  ...pdfDefaultSchemaMappings,
  blockMapping: {
    ...pdfDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutPDF,
    heading: blockMappingHeadingPDF,
    image: blockMappingImagePDF,
    paragraph: blockMappingParagraphPDF,
    divider: blockMappingDividerPDF,
    quote: blockMappingQuotePDF,
    table: blockMappingTablePDF,
  },
};
