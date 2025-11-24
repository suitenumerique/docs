import { DefaultProps } from '@blocknote/core';
import { Image, Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

const PIXELS_PER_POINT = 0.75;
const FONT_SIZE = 16;
const MAX_WIDTH = 600;

export const blockMappingImagePDF: DocsExporterPDF['mappings']['blockMapping']['image'] =
  async (block, exporter) => {
    const blob = await exporter.resolveFile(block.props.url);
    let pngConverted: string | undefined;
    let dimensions: { width: number; height: number } | undefined;
    let previewWidth = block.props.previewWidth || undefined;

    if (!blob.type.includes('image')) {
      return <View wrap={false} />;
    }

    if (blob.type.includes('svg')) {
      const svgText = await blob.text();
      const FALLBACK_SIZE = 536;
      previewWidth = previewWidth || FALLBACK_SIZE;

      const result = await convertSvgToPng(svgText, previewWidth);
      pngConverted = result.png;
      dimensions = { width: result.width, height: result.height };
    } else {
      dimensions = await getImageDimensions(blob);
    }

    if (!dimensions) {
      return <View wrap={false} />;
    }

    const { width, height } = dimensions;

    // Ensure the final width never exceeds MAX_WIDTH to prevent images
    // from overflowing the page width in the exported document
    const finalWidth = Math.min(previewWidth || width, MAX_WIDTH);
    const finalHeight = (finalWidth / width) * height;

    return (
      <View wrap={false}>
        <Image
          src={pngConverted || blob}
          style={{
            width: finalWidth * PIXELS_PER_POINT,
            height: finalHeight * PIXELS_PER_POINT,
            maxWidth: '100%',
          }}
        />
        {caption(block.props)}
      </View>
    );
  };

async function getImageDimensions(blob: Blob) {
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = url;

    return new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
    });
  }
}

function caption(
  props: Partial<DefaultProps & { caption: string; previewWidth: number }>,
) {
  if (!props.caption) {
    return undefined;
  }
  return (
    <Text
      style={{
        width: props.previewWidth
          ? props.previewWidth * PIXELS_PER_POINT
          : undefined,
        fontSize: FONT_SIZE * 0.8 * PIXELS_PER_POINT,
        maxWidth: '100%',
      }}
    >
      {props.caption}
    </Text>
  );
}
