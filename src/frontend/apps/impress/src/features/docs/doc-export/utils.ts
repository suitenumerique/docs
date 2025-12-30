import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import { Canvg } from 'canvg';
import { IParagraphOptions, ShadingType } from 'docx';
import React from 'react';

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
  width: number,
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

  return {
    png: canvas.toDataURL('image/png'),
    width,
    height: height || width,
  };
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
