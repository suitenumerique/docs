import { odtDefaultSchemaMappings } from '@blocknote/xl-odt-exporter';

import {
  blockMappingCalloutODT,
  blockMappingImageODT,
  blockMappingUploadLoaderODT,
} from './blocks-mapping';
import { inlineContentMappingInterlinkingLinkODT } from './inline-content-mapping';
import { DocsExporterODT } from './types';

// Align default inline mappings to our editor inline schema without using `any`
const baseInlineMappings =
  odtDefaultSchemaMappings.inlineContentMapping as unknown as DocsExporterODT['mappings']['inlineContentMapping'];

export const odtDocsSchemaMappings: DocsExporterODT['mappings'] = {
  ...odtDefaultSchemaMappings,
  blockMapping: {
    ...odtDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutODT,
    image: blockMappingImageODT,
    // We're reusing the file block mapping for PDF blocks
    // The types don't match exactly but the implementation is compatible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: odtDefaultSchemaMappings.blockMapping.file as any,
    uploadLoader: blockMappingUploadLoaderODT,
  },

  inlineContentMapping: {
    ...baseInlineMappings,
    interlinkingSearchInline: () => null,
    interlinkingLinkInline: inlineContentMappingInterlinkingLinkODT,
  },
  styleMapping: {
    ...odtDefaultSchemaMappings.styleMapping,
    textColor: (val, exporter): Record<string, string> => {
      if (!val) {
        return {};
      }
      const color = exporter.options.colors?.[val]?.text;

      if (!color) {
        return {};
      }

      return { 'fo:color': color };
    },

    backgroundColor: (val, exporter): Record<string, string> => {
      if (!val) {
        return {};
      }
      const color = exporter.options.colors?.[val]?.background;

      if (!color) {
        return {};
      }

      return { 'fo:background-color': color };
    },
  },
};
