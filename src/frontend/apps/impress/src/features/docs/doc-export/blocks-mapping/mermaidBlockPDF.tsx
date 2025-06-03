import { View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingMermaidBlockPDF: DocsExporterPDF['mappings']['blockMapping']['mermaid'] =
  () => {
    //TODO implement mermaid
    return <View wrap={false}></View>;
  };
