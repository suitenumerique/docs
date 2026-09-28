import { diagramBlockMapping } from '@blocknote/diagram-block/pdf-exporter';
import {
  inlineMathMapping,
  mathBlockMapping,
} from '@blocknote/math-block/pdf-exporter';
import { pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import {
  blockMappingCalloutPDF,
  blockMappingHeadingPDF,
  blockMappingImagePDF,
  blockMappingParagraphPDF,
  blockMappingQuotePDF,
  blockMappingTablePDF,
  blockMappingUploadLoaderPDF,
} from './blocks-mapping';
import { inlineContentMappingInterlinkingLinkPDF } from './inline-content-mapping';
import { DocsExporterPDF } from './types';

export const pdfDocsSchemaMappings: DocsExporterPDF['mappings'] = {
  ...pdfDefaultSchemaMappings,
  blockMapping: {
    ...pdfDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutPDF,
    heading: blockMappingHeadingPDF,
    image: blockMappingImagePDF,
    paragraph: blockMappingParagraphPDF,
    quote: blockMappingQuotePDF,
    table: blockMappingTablePDF,
    // We're using the file block mapping for PDF blocks
    // The types don't match exactly but the implementation is compatible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: pdfDefaultSchemaMappings.blockMapping.file as any,
    uploadLoader: blockMappingUploadLoaderPDF,
    // Renders the LaTeX as a vector formula (via @react-pdf/math).
    mathBlock: mathBlockMapping,
    // Renders the Mermaid source to a PNG in the browser (async mapping).
    diagram: diagramBlockMapping,
  },
  inlineContentMapping: {
    ...pdfDefaultSchemaMappings.inlineContentMapping,
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkPDF,
    // Inline math is rasterized to an image that flows with the text.
    math: inlineMathMapping,
  },
  styleMapping: {
    ...pdfDefaultSchemaMappings.styleMapping,
    // Switch to core PDF "Courier" font to avoid relying on GeistMono
    // that is not available in italics
    code: (enabled?: boolean) =>
      enabled ? { fontFamily: 'Courier', backgroundColor: '#dcdcdc' } : {},
  },
};
