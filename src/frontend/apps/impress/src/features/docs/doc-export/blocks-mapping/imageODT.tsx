import React from 'react';

import { DocsExporterODT } from '../types';
import { convertSvgToPng, odtRegisterParagraphStyleForBlock } from '../utils';

const MAX_WIDTH = 600;

export const blockMappingImageODT: DocsExporterODT['mappings']['blockMapping']['image'] =
  async (block, exporter) => {
    try {
      const blob = await exporter.resolveFile(block.props.url);

      if (!blob || !blob.type) {
        console.warn(`Failed to resolve image: ${block.props.url}`);
        return null;
      }

      let pngConverted: string | undefined;
      let dimensions: { width: number; height: number } | undefined;
      let previewWidth = block.props.previewWidth || undefined;

      if (!blob.type.includes('image')) {
        console.warn(`Not an image type: ${blob.type}`);
        return null;
      }

      if (blob.type.includes('svg')) {
        const svgText = await blob.text();
        const FALLBACK_SIZE = 536;
        previewWidth = previewWidth || blob.size || FALLBACK_SIZE;
        pngConverted = await convertSvgToPng(svgText, previewWidth);
        const img = new Image();
        img.src = pngConverted;
        await new Promise((resolve) => {
          img.onload = () => {
            dimensions = { width: img.width, height: img.height };
            resolve(null);
          };
        });
      } else {
        dimensions = await getImageDimensions(blob);
      }

      if (!dimensions) {
        return null;
      }

      const { width, height } = dimensions;

      if (previewWidth && previewWidth > MAX_WIDTH) {
        previewWidth = MAX_WIDTH;
      }

      // Convert image to base64 for ODT embedding
      const arrayBuffer = pngConverted
        ? await (await fetch(pngConverted)).arrayBuffer()
        : await blob.arrayBuffer();
      const base64 = btoa(
        Array.from(new Uint8Array(arrayBuffer))
          .map((byte) => String.fromCharCode(byte))
          .join(''),
      );

      const finalWidth = previewWidth || width;
      const finalHeight = ((previewWidth || width) / width) * height;

      const baseParagraphProps = {
        backgroundColor: block.props.backgroundColor,
        textAlignment: block.props.textAlignment,
      };

      const paragraphStyleName = odtRegisterParagraphStyleForBlock(
        exporter,
        baseParagraphProps,
        { paddingCm: 0 },
      );

      // Convert pixels to cm (ODT uses cm for dimensions)
      const widthCm = finalWidth / 37.795275591;
      const heightCm = finalHeight / 37.795275591;

      // Create ODT image structure using React.createElement
      const frame = React.createElement(
        'text:p',
        {
          'text:style-name': paragraphStyleName,
        },
        React.createElement(
          'draw:frame',
          {
            'draw:name': `Image${Date.now()}`,
            'text:anchor-type': 'as-char',
            'svg:width': `${widthCm}cm`,
            'svg:height': `${heightCm}cm`,
          },
          React.createElement(
            'draw:image',
            {
              xlinkType: 'simple',
              xlinkShow: 'embed',
              xlinkActuate: 'onLoad',
            },
            React.createElement('office:binary-data', {}, base64),
          ),
        ),
      );

      // Add caption if present
      if (block.props.caption) {
        const captionStyleName = odtRegisterParagraphStyleForBlock(
          exporter,
          baseParagraphProps,
          { paddingCm: 0, parentStyleName: 'Caption' },
        );

        return [
          frame,
          React.createElement(
            'text:p',
            { 'text:style-name': captionStyleName },
            block.props.caption,
          ),
        ];
      }

      return frame;
    } catch (error) {
      console.error(`Error processing image for ODT export:`, error);
      return null;
    }
  };

async function getImageDimensions(blob: Blob) {
  if (typeof window !== 'undefined') {
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    bmp.close();
    return { width, height };
  }
}
