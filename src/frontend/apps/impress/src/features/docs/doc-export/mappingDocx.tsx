import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';
import { TextRun } from 'docx';

import {
  blockMappingCalloutDocx,
  blockMappingImageDocx,
  blockMappingQuoteDocx,
  blockMappingUploadLoaderDocx,
} from './blocks-mapping';
import { inlineContentMappingInterlinkingLinkDocx } from './inline-content-mapping';
import { DocsExporterDocx } from './types';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutDocx,
    // We're reusing the file block mapping for PDF blocks; both share the same
    // implementation signature, so we can reuse the handler directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: docxDefaultSchemaMappings.blockMapping.file as any,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
    uploadLoader: blockMappingUploadLoaderDocx,
    table: (block, exporter, nestedLevel, numberedListIndex, children) => {
      /**
       * Nan values are not supported, so we need to replace them with undefined
       * to avoid issues during the export.
       */
      const { columnWidths } = block.content;
      const hasNaN = columnWidths.some(
        (width) => typeof width === 'number' && Number.isNaN(width),
      );
      if (hasNaN) {
        block.content.columnWidths = columnWidths.map((width) =>
          typeof width === 'number' && Number.isNaN(width) ? undefined : width,
        );
      }

      return docxDefaultSchemaMappings.blockMapping.table(
        block,
        exporter,
        nestedLevel,
        numberedListIndex,
        children,
      );
    },
  },
  inlineContentMapping: {
    ...docxDefaultSchemaMappings.inlineContentMapping,
    interlinkingSearchInline: () => new TextRun(''),
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
