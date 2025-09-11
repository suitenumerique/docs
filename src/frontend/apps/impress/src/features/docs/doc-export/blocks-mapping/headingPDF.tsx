import { Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';

// Helper function to extract plain text from block content
function extractTextFromBlockContent(content: unknown[]): string {
  return content
    .map((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        'text' in item
      ) {
        if (item.type === 'text' && typeof item.text === 'string') {
          return item.text;
        }
      }
      return '';
    })
    .join('')
    .trim();
}

export const blockMappingHeadingPDF: DocsExporterPDF['mappings']['blockMapping']['heading'] =
  (block, exporter) => {
    const PIXELS_PER_POINT = 0.75;
    const MERGE_RATIO = 7.5;
    const FONT_SIZE = 16;
    const fontSizeEM =
      block.props.level === 1 ? 2 : block.props.level === 2 ? 1.5 : 1.17;

    // Extract plain text for bookmark title
    const bookmarkTitle =
      extractTextFromBlockContent(block.content) || 'Untitled';

    return (
      <Text
        key={block.id}
        // @ts-expect-error: bookmark is supported by react-pdf but not typed
        bookmark={{
          title: bookmarkTitle,
        }}
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
