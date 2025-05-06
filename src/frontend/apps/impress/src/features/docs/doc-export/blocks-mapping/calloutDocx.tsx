import { Paragraph, ShadingType, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

const docxcolors: { [k: string]: string } = {
  default: 'auto',
  gray: 'ebeced',
  brown: 'eae5e3',
  red: 'ffe2e3',
  orange: 'f8ead8',
  yellow: 'fbf6da',
  green: 'd9efeb',
  blue: 'daebf2',
  purple: 'ede1f2',
  pink: 'fadbea',
};

export const blockMappingCalloutDocx: DocsExporterDocx['mappings']['blockMapping']['callout'] =
  (block, exporter) => {
    return new Paragraph({
      shading: {
        type: ShadingType.DIAGONAL_CROSS,
        fill: docxcolors[block.props.backgroundColor],
      },
      children: [
        new TextRun(block.props.emoji + ' '),
        ...exporter.transformInlineContent(block.content),
      ],
    });
  };
