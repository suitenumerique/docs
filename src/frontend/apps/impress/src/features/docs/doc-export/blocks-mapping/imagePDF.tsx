import { DefaultProps } from '@blocknote/core';
import { Image, Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';
import { convertBlobToPng, convertSvgToPng } from '../utils';

const PIXELS_PER_POINT = 0.75;
const FONT_SIZE = 16;
const MAX_WIDTH = 600;

/**
 * Renders an image block as a PDF element.
 *
 * Resolves the image file, transcodes it to a PNG data URL via canvas (so
 * that formats unsupported by @react-pdf/renderer such as WebP are handled),
 * computes the final display dimensions (clamped to MAX_WIDTH), and returns a
 * react-pdf View containing the Image and an optional caption.
 *
 * @param block - The image block, including the image URL, optional previewWidth, and caption.
 * @param exporter - The PDF exporter, used to resolve the image URL to a Blob.
 * @returns A react-pdf View element, or an empty View when the blob is not an
 * image or the conversion fails.
 */
export const blockMappingImagePDF: DocsExporterPDF['mappings']['blockMapping']['image'] =
  async (block, exporter) => {
    const blob = await exporter.resolveFile(block.props.url);
    let result: { png: string; width: number; height: number } | undefined;
    const previewWidth = block.props.previewWidth
      ? Math.min(block.props.previewWidth, MAX_WIDTH)
      : undefined;

    if (!blob.type.includes('image')) {
      return <View wrap={false} />;
    }

    try {
      if (blob.type.includes('svg')) {
        const svgText = await blob.text();
        result = await convertSvgToPng(svgText, previewWidth);
      } else {
        result = await convertBlobToPng(blob, previewWidth);
      }
    } catch {
      return <View wrap={false} />;
    }

    if (!result || !result.png) {
      return <View wrap={false} />;
    }

    const { width, height } = result;

    // Ensure the final width never exceeds MAX_WIDTH to prevent images
    // from overflowing the page width in the exported document
    const finalWidth = Math.min(previewWidth || width, MAX_WIDTH);
    const finalHeight = (finalWidth / width) * height;

    return (
      <View wrap={false}>
        <Image
          src={result.png}
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
