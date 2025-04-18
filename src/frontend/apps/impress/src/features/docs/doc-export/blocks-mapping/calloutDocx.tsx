import { Paragraph, ShadingType, TextRun } from 'docx';

const docxcolors = {
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

export const blockMappingCalloutDocx = (block, exporter) => {
  return new Paragraph({
    shading: {
      type: ShadingType.DIAGONAL_CROSS,
      fill: docxcolors[block.props.backgroundColor], // todo: make this variable from the block props
    },
    children: [
      new TextRun(block.props.emoji + ' '),
      ...exporter.transformInlineContent(block.content),
    ],
  });
};
