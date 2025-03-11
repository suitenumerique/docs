import { Paragraph } from 'docx';

import { useCunninghamTheme } from '@/cunningham';

import { DocsExporterDocx } from '../types';

export const blockMappingDividerDocx: DocsExporterDocx['mappings']['blockMapping']['divider'] =
  () => {
    const { colorsTokens } = useCunninghamTheme.getState();

    return new Paragraph({
      spacing: {
        before: 200,
      },
      border: {
        top: {
          color: colorsTokens()['greyscale-300'],
          size: 1,
          style: 'single',
          space: 1,
        },
      },
    });
  };
