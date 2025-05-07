import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import { Canvg } from 'canvg';
import { IParagraphOptions, ShadingType } from 'docx';

export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Converts an SVG string into a PNG image and returns it as a data URL.
 *
 * This function creates a canvas, parses the SVG, calculates the appropriate height
 * to preserve the aspect ratio, and renders the SVG onto the canvas using Canvg.
 *
 * @param {string} svgText - The raw SVG markup to convert.
 * @param {number} width - The desired width of the output PNG (height is auto-calculated to preserve aspect ratio).
 * @returns {Promise<string>} A Promise that resolves to a PNG image encoded as a base64 data URL.
 *
 * @throws Will throw an error if the canvas context cannot be initialized.
 */
export async function convertSvgToPng(svgText: string, width: number) {
  // Create a canvas and render the SVG onto it
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    alpha: true,
  });

  if (!ctx) {
    throw new Error('Canvas context is null');
  }

  // Parse SVG to get original dimensions
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  // Get viewBox or fallback to width/height attributes
  let height;
  const svgWidth = svgElement.getAttribute?.('width');
  const svgHeight = svgElement.getAttribute?.('height');
  const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number);

  const originalWidth = svgWidth ? parseInt(svgWidth) : viewBox?.[2];
  const originalHeight = svgHeight ? parseInt(svgHeight) : viewBox?.[3];
  if (originalWidth && originalHeight) {
    const aspectRatio = originalHeight / originalWidth;
    height = Math.round(width * aspectRatio);
  }

  const svg = Canvg.fromString(ctx, svgText);
  svg.resize(width, height, true);
  await svg.render();

  return canvas.toDataURL('image/png');
}

export function docxBlockPropsToStyles(
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
