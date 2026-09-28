import { diagramBlockMapping } from '@blocknote/diagram-block/docx-exporter';
import {
  inlineMathMapping,
  mathBlockMapping,
} from '@blocknote/math-block/docx-exporter';
import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';

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
    // Renders the LaTeX as a native (editable) Word equation.
    mathBlock: mathBlockMapping,
    // Renders the Mermaid source to a PNG in the browser (async mapping).
    diagram: diagramBlockMapping,
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
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkDocx,
    // Renders inline math as a native (editable) Word equation.
    math: inlineMathMapping,
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
