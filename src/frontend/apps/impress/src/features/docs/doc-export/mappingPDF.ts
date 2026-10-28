import { diagramBlockMapping } from '@blocknote/diagram-block/typst-exporter';
import {
  inlineMathMapping,
  mathBlockMapping,
} from '@blocknote/math-block/typst-exporter';
import { typstDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingCalloutPDF,
  blockMappingUploadLoaderPDF,
  createBlockMappingImagePDF,
} from './blocks-mapping';
import {
  createInlineContentMappingInterlinkingLinkPDF,
  inlineContentMappingMentionSearchPDF,
  inlineContentMappingUserMentionPDF,
} from './inline-content-mapping';
import { DocsExporterPDF } from './types';
import { getBlockMappingFunction } from './utils';

/**
 * Width available for the content on an A4 page with the default 48pt
 * margins of the Typst exporter, in pixels.
 */
const PAGE_CONTENT_WIDTH = (595 - 2 * 48) / 0.75;

/**
 * Width in pixels assumed for a column without a width (never resized in the
 * editor) when checking that a table fits in the page.
 */
const UNKNOWN_COLUMN_WIDTH = 120;

/**
 * Scales the column widths down so that the table fits in the page.
 * When the table fits, the columns without a width (or a NaN one) are left to
 * Typst to size automatically. Otherwise every column gets a fixed width,
 * proportional to its width in the editor.
 */
export const fitColumnWidths = (
  columnWidths: (number | undefined)[],
  maxWidth = PAGE_CONTENT_WIDTH,
): (number | undefined)[] => {
  const knownWidths = columnWidths.map((width) =>
    typeof width === 'number' && !Number.isNaN(width) ? width : undefined,
  );
  const total = knownWidths.reduce<number>(
    (sum, width) => sum + (width ?? UNKNOWN_COLUMN_WIDTH),
    0,
  );

  if (total <= maxWidth) {
    return knownWidths;
  }

  const scale = maxWidth / total;
  return knownWidths.map((width) =>
    Math.floor((width ?? UNKNOWN_COLUMN_WIDTH) * scale),
  );
};

export const getPdfDocsSchemaMappings = (
  interlinkTitles: Map<string, string>,
  imageUnavailableText: string,
): DocsExporterPDF['mappings'] => ({
  ...typstDefaultSchemaMappings,
  blockMapping: {
    ...typstDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutPDF,
    image: createBlockMappingImagePDF(imageUnavailableText),
    // We're using the file block mapping for PDF blocks
    // The types don't match exactly but the implementation is compatible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: typstDefaultSchemaMappings.blockMapping.file as any,
    table: (block, ...args) =>
      getBlockMappingFunction(typstDefaultSchemaMappings.blockMapping.table)(
        {
          ...block,
          content: {
            ...block.content,
            columnWidths: fitColumnWidths(block.content.columnWidths),
          },
        },
        ...args,
      ),
    uploadLoader: blockMappingUploadLoaderPDF,
    // Renders the LaTeX as a native Typst equation.
    mathBlock: mathBlockMapping,
    // Renders the Mermaid source to an embedded vector SVG.
    diagram: diagramBlockMapping,
  },
  inlineContentMapping: {
    ...typstDefaultSchemaMappings.inlineContentMapping,
    interlinkingLinkInline:
      createInlineContentMappingInterlinkingLinkPDF(interlinkTitles),
    mentionSearchInline: inlineContentMappingMentionSearchPDF,
    userMentionInline: inlineContentMappingUserMentionPDF,
    math: inlineMathMapping,
  },
});
