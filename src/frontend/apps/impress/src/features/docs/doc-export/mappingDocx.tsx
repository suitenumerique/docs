import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';
import { Paragraph } from 'docx';

import {
  blockMappingCalloutDocx,
  blockMappingDividerDocx,
  blockMappingImageDocx,
  blockMappingQuoteDocx,
} from './blocks-mapping';
import { inlineContentMappingInterlinkingLinkDocx } from './inline-content-mapping';
import { DocsExporterDocx } from './types';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutDocx,
    divider: blockMappingDividerDocx,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
  },
  inlineContentMapping: {
    ...docxDefaultSchemaMappings.inlineContentMapping,
    interlinkingSearchInline: () => new Paragraph(''),
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkDocx,
  },
};
