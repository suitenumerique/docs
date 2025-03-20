import { Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

export const blockMappingHeadingPDF: DocsExporterPDF['mappings']['blockMapping']['heading'] =
  (block, exporter) => {
    const PIXELS_PER_POINT = 0.75;
    const MERGE_RATIO = 7.5;
    const FONT_SIZE = 16;
    const fontSizeEM =
      block.props.level === 1 ? 2 : block.props.level === 2 ? 1.5 : 1.17;
    return (
      <Text
        key={block.id}
        style={{
          fontSize: fontSizeEM * FONT_SIZE * PIXELS_PER_POINT,
          fontWeight: 700,
          marginTop: `${fontSizeEM * MERGE_RATIO}px`,
          marginBottom: `${fontSizeEM * MERGE_RATIO}px`,
        }}
      >
        {exporter.transformInlineContent(block.content)}
      </Text>
    );
  };
