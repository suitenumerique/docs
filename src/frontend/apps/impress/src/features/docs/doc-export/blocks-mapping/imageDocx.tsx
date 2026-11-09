import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import {
  IParagraphOptions,
  ImageRun,
  Paragraph,
  ShadingType,
  TextRun,
} from 'docx';

import { DocsExporterDocx } from '../types';
import { convertSvgToPng, getImageUnavailableText } from '../utils';

const MAX_WIDTH = 600;

/**
 * An image that cannot be resolved or decoded is replaced by
 * `unavailableText` instead of failing the whole export.
 */
export const createBlockMappingImageDocx =
  (
    unavailableText: string,
  ): DocsExporterDocx['mappings']['blockMapping']['image'] =>
  async (block, exporter) => {
    if (!block.props.url) {
      return [];
    }

    const unavailable = new Paragraph({
      ...blockPropsToStyles(block.props, exporter.options.colors),
      children: [
        new TextRun({
          text: getImageUnavailableText(unavailableText, block.props),
          italics: true,
          color: '6E6E6E',
        }),
      ],
    });

    let blob: Blob;
    let pngConverted: string | undefined;
    let dimensions: { width: number; height: number } | undefined;
    let previewWidth = block.props.previewWidth || undefined;

    try {
      blob = await exporter.resolveFile(block.props.url);

      if (!blob.type.includes('image')) {
        return unavailable;
      }

      if (blob.type.includes('svg')) {
        const svgText = await blob.text();
        const FALLBACK_SIZE = 536;
        previewWidth = previewWidth || blob.size || FALLBACK_SIZE;

        const result = await convertSvgToPng(svgText, previewWidth);
        pngConverted = result.png;
        dimensions = { width: result.width, height: result.height };
      } else {
        dimensions = await getImageDimensions(blob);
      }
    } catch {
      return unavailable;
    }

    if (!dimensions) {
      return unavailable;
    }

    const { width, height } = dimensions;

    // Ensure the final width never exceeds MAX_WIDTH to prevent images
    // from overflowing the page width in the exported document
    const finalWidth = Math.min(previewWidth || width, MAX_WIDTH);

    return [
      new Paragraph({
        ...blockPropsToStyles(block.props, exporter.options.colors),
        children: [
          new ImageRun({
            data: pngConverted
              ? await (await fetch(pngConverted)).arrayBuffer()
              : await blob.arrayBuffer(),
            type: pngConverted ? 'png' : 'gif',
            altText: block.props.caption
              ? {
                  description: block.props.caption,
                  name: block.props.caption,
                  title: block.props.caption,
                }
              : undefined,
            transformation: {
              width: finalWidth,
              height: (finalWidth / width) * height,
            },
          }),
        ],
      }),
      ...caption(block.props, exporter as DocsExporterDocx),
    ];
  };

async function getImageDimensions(blob: Blob) {
  if (typeof window !== 'undefined') {
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp;
    bmp.close();
    return { width, height };
  }
}

function blockPropsToStyles(
  props: Partial<DefaultProps>,
  colors: typeof COLORS_DEFAULT,
): IParagraphOptions {
  return {
    shading:
      props.backgroundColor === 'default' || !props.backgroundColor
        ? undefined
        : {
            type: ShadingType.SOLID,
            color: colors[props.backgroundColor].background.slice(1),
          },
    run:
      props.textColor === 'default' || !props.textColor
        ? undefined
        : {
            color: colors[props.textColor].text.slice(1),
          },
    alignment:
      !props.textAlignment || props.textAlignment === 'left'
        ? undefined
        : props.textAlignment === 'center'
          ? 'center'
          : props.textAlignment === 'right'
            ? 'right'
            : props.textAlignment === 'justify'
              ? 'distribute'
              : (() => {
                  throw new UnreachableCaseError(props.textAlignment);
                })(),
  };
}

function caption(
  props: Partial<DefaultProps & { caption: string }>,
  exporter: DocsExporterDocx,
) {
  if (!props.caption) {
    return [];
  }
  return [
    new Paragraph({
      ...blockPropsToStyles(props, exporter.options.colors),
      children: [
        new TextRun({
          text: props.caption,
        }),
      ],
      style: 'Caption',
    }),
  ];
}
