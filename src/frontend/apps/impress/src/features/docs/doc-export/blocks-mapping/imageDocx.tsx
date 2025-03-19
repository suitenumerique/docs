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
import { convertSvgToPng } from '../utils';

const MAX_WIDTH = 600;

export const blockMappingImageDocx: DocsExporterDocx['mappings']['blockMapping']['image'] =
  async (block, exporter) => {
    const blob = await exporter.resolveFile(block.props.url);
    let pngConverted: string | undefined;
    let dimensions: { width: number; height: number } | undefined;

    if (!blob.type.includes('image')) {
      return [];
    }

    if (blob.type.includes('svg')) {
      const svgText = await blob.text();
      pngConverted = await convertSvgToPng(svgText, block.props.previewWidth);
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
      return [];
    }

    const { width, height } = dimensions;

    let previewWidth = block.props.previewWidth;
    if (previewWidth > MAX_WIDTH) {
      previewWidth = MAX_WIDTH;
    }

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
              width: previewWidth,
              height: (previewWidth / width) * height,
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
            color:
              colors[
                props.backgroundColor as keyof typeof colors
              ].background.slice(1),
          },
    run:
      props.textColor === 'default' || !props.textColor
        ? undefined
        : {
            color: colors[props.textColor as keyof typeof colors].text.slice(1),
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
