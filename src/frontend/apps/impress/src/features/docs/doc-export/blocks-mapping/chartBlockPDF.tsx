import { View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingChartBlockPDF: DocsExporterPDF['mappings']['blockMapping']['chart'] =
  () => {
    //TODO implement chart block
    return <View wrap={false}></View>;
  };
