import { Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingInlineLatexPDF: DocsExporterPDF['mappings']['inlineContentMapping']['inlineLatex'] =
  (content) => {
    return (
      //TODO implement inlineLatex
      <View wrap={false}>
        <Text>{content.props.formula}</Text>
      </View>
    );
  };
