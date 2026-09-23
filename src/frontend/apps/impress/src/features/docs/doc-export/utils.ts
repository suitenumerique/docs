import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import { Canvg } from 'canvg';
import { IParagraphOptions, ShadingType } from 'docx';
import React from 'react';

const WINDOWS_RESERVED_FILENAME =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/**
 * Converts a document title into a safe filename for exported files.
 */
export function getExportFilename(title: string): string {
  const filename = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/[. ]+$/g, '');

  if (!filename) {
    return 'document';
  }

  return WINDOWS_RESERVED_FILENAME.test(filename) ? `_${filename}` : filename;
}

/**
 * Triggers a browser download of a Blob with the given filename.
 *
 * @param blob - The data to download.
 * @param filename - The name the downloaded file should have.
 */
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
 * Converts an SVG string into a PNG image and returns it as a data URL with dimensions.
 *
 * This function creates a canvas, parses the SVG, calculates the appropriate height
 * to preserve the aspect ratio, and renders the SVG onto the canvas using Canvg.
 *
 * @param {string} svgText - The raw SVG markup to convert.
 * @param {number} width - The desired width of the output PNG (height is auto-calculated to preserve aspect ratio).
 * @returns {Promise<{ png: string; width: number; height: number }>} A Promise that resolves to an object containing the PNG data URL and its dimensions.
 *
 * @throws Will throw an error if the canvas context cannot be initialized.
 */
export async function convertSvgToPng(
  svgText: string,
  width?: number,
): Promise<{ png: string; width: number; height: number }> {
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
  let calculatedHeight: number | undefined;
  const svgWidth = svgElement.getAttribute?.('width');
  const svgHeight = svgElement.getAttribute?.('height');
  const viewBox = svgElement
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);

  const parsedWidth = svgWidth ? parseFloat(svgWidth) : viewBox?.[2];
  const parsedHeight = svgHeight ? parseFloat(svgHeight) : viewBox?.[3];
  const originalWidth =
    parsedWidth !== undefined && Number.isFinite(parsedWidth) && parsedWidth > 0
      ? parsedWidth
      : undefined;
  const originalHeight =
    parsedHeight !== undefined &&
    Number.isFinite(parsedHeight) &&
    parsedHeight > 0
      ? parsedHeight
      : undefined;

  const svg = Canvg.fromString(ctx, svgText);

  const FALLBACK_WIDTH = 536;
  const requestedWidth =
    width !== undefined && Number.isFinite(width) && width > 0
      ? width
      : undefined;

  // Resize if width provided, preserving aspect ratio
  if (originalWidth && originalHeight && requestedWidth) {
    const aspectRatio = originalHeight / originalWidth;
    const scaledHeight = Math.round(requestedWidth * aspectRatio);
    if (Number.isFinite(scaledHeight) && scaledHeight > 0) {
      calculatedHeight = scaledHeight;
      svg.resize(requestedWidth, calculatedHeight, true);
    }
  } else if (!requestedWidth && !originalWidth) {
    svg.resize(FALLBACK_WIDTH, undefined, true);
  }

  await svg.render();

  const returnWidth =
    calculatedHeight || !originalHeight
      ? requestedWidth || originalWidth || FALLBACK_WIDTH
      : originalWidth || requestedWidth || FALLBACK_WIDTH;
  const returnHeight = calculatedHeight || originalHeight || returnWidth;

  return {
    png: canvas.toDataURL('image/png'),
    width: returnWidth,
    height: returnHeight,
  };
}

/**
 * Converts any raster format (PNG, WebP, JPEG, ...) into a PNG data URL via canvas.
 *
 * This function creates a canvas, draws the image to it, and returns its data URL and size.
 *
 * @param {Blob} blob - The raw raster image to convert.
 * @param {number} width - The desired width of the output PNG (height is auto-calculated to preserve aspect ratio).
 * @returns {Promise<{ png: string; width: number; height: number }>} A Promise that resolves to an object containing the PNG data URL and its dimensions.
 *
 * @throws Will throw an error if the canvas context cannot be initialized.
 */
// Convert any raster format (PNG, WebP, JPEG, …) to a PNG data URL via
// canvas. This has two benefits:
//   1. Formats unsupported by @react-pdf/renderer (e.g. WebP) are
//      transcoded to PNG which react-pdf can embed.
//   2. Passing a raw Blob to react-pdf triggers a WASM "too many
//      arguments" error in its internal image pipeline; a canvas-derived
//      data URL sidesteps that entirely.
export async function convertBlobToPng(
  blob: Blob,
  width?: number,
): Promise<{ png: string; width: number; height: number } | undefined> {
  if (typeof window === 'undefined') {
    return;
  }
  const bmp = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');

    let calculatedHeight: number | undefined;
    // Resize if width provided, preserving aspect ratio
    if (width) {
      canvas.width = width;
      const aspectRatio = bmp.height / bmp.width;
      calculatedHeight = Math.round(width * aspectRatio);
      canvas.height = calculatedHeight;
    } else {
      canvas.width = bmp.width;
      canvas.height = bmp.height;
    }

    const ctx = canvas.getContext('2d', {
      alpha: true,
    });
    if (!ctx) {
      throw new Error('Canvas context is null');
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return {
      png: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bmp.close();
  }
}

/**
 * Converts BlockNote block props (background color, text color, alignment)
 * into a docx IParagraphOptions object for use with the docx exporter.
 *
 * @param props - Partial BlockNote default props.
 * @param colors - The color palette to resolve named colors.
 * @returns A docx paragraph options object with shading, run color, and alignment.
 */
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

// ODT helpers
type OdtExporterLike = {
  options?: { colors?: typeof COLORS_DEFAULT };
  registerStyle: (fn: (name: string) => React.ReactNode) => string;
};

function isOdtExporterLike(value: unknown): value is OdtExporterLike {
  return (
    !!value &&
    typeof (value as { registerStyle?: unknown }).registerStyle === 'function'
  );
}

export function odtRegisterParagraphStyleForBlock(
  exporter: unknown,
  props: Partial<DefaultProps>,
  options?: { paddingCm?: number; parentStyleName?: string },
) {
  if (!isOdtExporterLike(exporter)) {
    throw new Error('Invalid ODT exporter: missing registerStyle');
  }

  const colors = exporter.options?.colors;

  const bgColorHex =
    props.backgroundColor && props.backgroundColor !== 'default' && colors
      ? colors[props.backgroundColor].background
      : undefined;

  const textColorHex =
    props.textColor && props.textColor !== 'default' && colors
      ? colors[props.textColor].text
      : undefined;

  const foTextAlign =
    !props.textAlignment || props.textAlignment === 'left'
      ? 'start'
      : props.textAlignment === 'center'
        ? 'center'
        : props.textAlignment === 'right'
          ? 'end'
          : 'justify';

  const paddingCm = options?.paddingCm ?? 0.42; // ~1rem (16px)
  const parentStyleName = options?.parentStyleName;

  // registerStyle is available on ODT exporter; call through with React elements
  const styleName = exporter.registerStyle((name: string) =>
    React.createElement(
      'style:style',
      {
        'style:name': name,
        'style:family': 'paragraph',
        ...(parentStyleName
          ? { 'style:parent-style-name': parentStyleName }
          : {}),
      },
      React.createElement('style:paragraph-properties', {
        'fo:text-align': foTextAlign,
        'fo:padding': `${paddingCm}cm`,
        ...(bgColorHex ? { 'fo:background-color': bgColorHex } : {}),
      }),
      textColorHex
        ? React.createElement('style:text-properties', {
            'fo:color': textColorHex,
          })
        : undefined,
    ),
  );

  return styleName;
}
