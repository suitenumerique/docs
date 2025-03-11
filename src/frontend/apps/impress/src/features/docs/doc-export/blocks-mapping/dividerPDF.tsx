import { Text } from '@react-pdf/renderer';

import { useCunninghamTheme } from '@/cunningham';

import { DocsExporterPDF } from '../types';

export const blockMappingDividerPDF: DocsExporterPDF['mappings']['blockMapping']['divider'] =
  () => {
    const { colorsTokens } = useCunninghamTheme.getState();

    return (
      <Text
        style={{
          marginVertical: 10,
          backgroundColor: colorsTokens()['greyscale-300'],
          height: '2px',
        }}
      />
    );
  };
