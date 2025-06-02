import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';

import {
  blockMappingCalloutDocx,
  blockMappingDatabaseDocx,
  blockMappingDividerDocx,
  blockMappingImageDocx,
  blockMappingQuoteDocx,
} from './blocks-mapping';
import { DocsExporterDocx } from './types';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    callout: blockMappingCalloutDocx,
    divider: blockMappingDividerDocx,
    database: blockMappingDatabaseDocx,
    quote: blockMappingQuoteDocx,
    image: blockMappingImageDocx,
  },
};
