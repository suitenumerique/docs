import { BlockMapping } from '@blocknote/core';
import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingCalloutPDF,
  blockMappingDatabasePDF,
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
    database: blockMappingDatabasePDF, // TODO: create Db block
    heading: blockMappingHeadingPDF,
    image: blockMappingImagePDF,
    paragraph: blockMappingParagraphPDF,
    divider: blockMappingDividerPDF,
    quote: blockMappingQuotePDF,
    table: blockMappingTablePDF,
  } as BlockMapping<any, any, any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any,
};
