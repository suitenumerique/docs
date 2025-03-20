import { Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingQuotePDF: DocsExporterPDF['mappings']['blockMapping']['quote'] =
  (block, exporter) => {
    return (
      <Text
        style={{
          fontStyle: 'italic',
          marginVertical: 10,
          paddingVertical: 5,
          paddingLeft: 10,
          borderLeft: '4px solid #cecece',
          color: '#666',
        }}
      >
        {exporter.transformInlineContent(block.content)}
      </Text>
    );
  };
