import { Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingUploadLoaderPDF: DocsExporterPDF['mappings']['blockMapping']['uploadLoader'] =
  (block) => {
    return (
      <View wrap={false} style={{ flexDirection: 'row', gap: 4 }}>
        <Text>{block.props.type === 'loading' ? '⏳' : '⚠️'}</Text>
        <Text>{block.props.information}</Text>
      </View>
    );
  };
