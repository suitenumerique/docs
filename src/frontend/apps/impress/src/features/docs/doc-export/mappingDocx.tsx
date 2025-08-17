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
    // We're using the file block mapping for PDF blocks
    // The types don't match exactly but the implementation is compatible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: docxDefaultSchemaMappings.blockMapping.file as any,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
  },
  inlineContentMapping: {
    ...docxDefaultSchemaMappings.inlineContentMapping,
    interlinkingSearchInline: () => new Paragraph(''),
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkDocx,
  },
  styleMapping: {
    ...docxDefaultSchemaMappings.styleMapping,
    // Switch to core PDF "Courier" font to avoid relying on GeistMono
    // that is not available in italics
    code: (enabled?: boolean) =>
      enabled
        ? {
            font: 'Courier New',
            shading: { fill: 'DCDCDC' },
          }
        : {},
  },
};
