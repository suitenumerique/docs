/* eslint-disable jsx-a11y/alt-text */
import { DefaultProps } from '@blocknote/core';
import { Image, Text, View } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

const PIXELS_PER_POINT = 0.75;
const FONT_SIZE = 16;

export const blockMappingImagePDF: DocsExporterPDF['mappings']['blockMapping']['image'] =
  async (block, exporter) => {
    const blob = await exporter.resolveFile(block.props.url);
    let pngConverted: string | undefined;

    if (!blob.type.includes('image')) {
      return <View wrap={false} />;
    }

    if (blob.type.includes('svg')) {
      const svgText = await blob.text();
      pngConverted = await convertSvgToPng(svgText, block.props.previewWidth);
    }

    return (
      <View wrap={false}>
        <Image
          src={pngConverted || blob}
          style={{
            width: block.props.previewWidth * PIXELS_PER_POINT,
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
