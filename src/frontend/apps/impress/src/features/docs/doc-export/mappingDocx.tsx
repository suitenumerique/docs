import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';

import {
  blockMappingCalloutDocx,
  blockMappingDividerDocx,
  blockMappingImageDocx,
  blockMappingQuoteDocx,
} from './blocks-mapping';
import { DocsExporterDocx } from './types';
import { blockMappingEmbedDocx } from './blocks-mapping/embedDocx';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutDocx,
    divider: blockMappingDividerDocx,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
    embed: blockMappingEmbedDocx,
  },
};
