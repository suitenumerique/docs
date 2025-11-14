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
  },
  inlineContentMapping: {
    ...pdfDefaultSchemaMappings.inlineContentMapping,
    interlinkingSearchInline: () => <></>,
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkPDF,
  },
  styleMapping: {
    ...pdfDefaultSchemaMappings.styleMapping,
    // Switch to core PDF "Courier" font to avoid relying on GeistMono
    // that is not available in italics
    code: (enabled?: boolean) =>
      enabled ? { fontFamily: 'Courier', backgroundColor: '#dcdcdc' } : {},
    // If the color is not defined, we fall back to default colors
    textColor: (val, exporter) => {
      if (!val) {
        return {};
      }

      const color = exporter.options.colors?.[val]?.text;

      if (!color) {
        return {};
      }

      return {
        color,
      };
    },
    // If the color is not defined, we fall back to default colors
    backgroundColor: (val, exporter) => {
      if (!val) {
        return {};
      }

      const backgroundColor = exporter.options.colors?.[val]?.background;

      if (!backgroundColor) {
        return {};
      }

      return {
        backgroundColor,
      };
    },
  },
};
