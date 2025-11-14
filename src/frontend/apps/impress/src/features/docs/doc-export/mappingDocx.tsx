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
        shading: {
          fill: backgroundColor.slice(1),
        },
      };
    },
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
        color: color.slice(1),
      };
    },
  },
};
