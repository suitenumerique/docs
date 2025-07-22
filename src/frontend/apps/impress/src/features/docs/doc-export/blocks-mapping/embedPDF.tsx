import { Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingEmbedPDF: DocsExporterPDF['mappings']['blockMapping']['embed'] =
  () => {
    return <Text />;
  };
