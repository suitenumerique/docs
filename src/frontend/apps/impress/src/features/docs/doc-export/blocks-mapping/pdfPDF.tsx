import { Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingPdfPDF: DocsExporterPDF['mappings']['blockMapping']['pdf'] =
  (block) => {
    const pdfName = block.props.name || 'PDF Document';
    const pdfUrl = block.props.url;

    return (
      <View
        style={{
          marginVertical: 10,
          padding: 10,
          border: '1px solid #ccc',
          borderRadius: 4,
          backgroundColor: '#f9f9f9',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>
          📄 {pdfName}
        </Text>
        {pdfUrl && (
          <Text style={{ fontSize: 10, color: '#666' }}>Source: {pdfUrl}</Text>
        )}
        <Text style={{ fontSize: 10, color: '#999', marginTop: 5 }}>
          [PDF content cannot be embedded in exported PDF]
        </Text>
      </View>
    );
  };
