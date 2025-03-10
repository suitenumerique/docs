import { docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter';

import {
  blockMappingDividerDocx,
  blockMappingQuoteDocx,
} from './blocks-mapping/';
import { DocsExporterDocx } from './types';

export const docxDocsSchemaMappings: DocsExporterDocx['mappings'] = {
  ...docxDefaultSchemaMappings,
  blockMapping: {
    ...docxDefaultSchemaMappings.blockMapping,
    divider: blockMappingDividerDocx,
    quote: blockMappingQuoteDocx,
  },
};
