import { TypstExporter, strLit } from '@blocknote/xl-pdf-exporter';

import { DocsBlockMappingPDF } from '../types';
import {
  convertBlobToPng,
  convertSvgToPng,
  getImageUnavailableText,
} from '../utils';

const PIXELS_PER_POINT = 0.75;
const MAX_WIDTH = 600;

/**
 * Decodes the base64 payload of a data URL.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Renders an image block as a tagged Typst figure.
 *
 * The image is transcoded to PNG via canvas, so any format the browser can
 * decode is exported, and resized to its preview width (clamped to MAX_WIDTH).
 * Unlike the default BlockNote mapping, an image that cannot be resolved or
 * decoded is replaced by `unavailableText` instead of failing the whole export.
 *
 * The alternative text is the file name, as in the editor, else the caption.
 */
export const createBlockMappingImagePDF =
  (unavailableText: string): DocsBlockMappingPDF<'image'> =>
  async (block, exporter) => {
    const { url, caption, name, textAlignment } = block.props;
    if (!url) {
      return '';
    }

    const unavailable = `#text(fill: luma(110), style: "italic")[#${strLit(
      getImageUnavailableText(unavailableText, block.props),
    )}]`;

    const previewWidth = block.props.previewWidth
      ? Math.min(block.props.previewWidth, MAX_WIDTH)
      : undefined;

    let result: { png: string; width: number } | undefined;
    try {
      const blob = await exporter.resolveFile(url);
      if (!blob.type.includes('image')) {
        return unavailable;
      }

      result = blob.type.includes('svg')
        ? await convertSvgToPng(await blob.text(), previewWidth)
        : await convertBlobToPng(blob, previewWidth);
    } catch {
      return unavailable;
    }

    if (!result?.png) {
      return unavailable;
    }

    // Ensure the final width never exceeds MAX_WIDTH to prevent images
    // from overflowing the page width in the exported document
    const finalWidth = Math.min(previewWidth || result.width, MAX_WIDTH);

    const path = (
      exporter as unknown as TypstExporter<never, never, never>
    ).registerImageBytes(`${url}|${finalWidth}`, dataUrlToBytes(result.png));

    const image = `image(${strLit(path)}, width: ${(
      finalWidth * PIXELS_PER_POINT
    ).toFixed(1)}pt)`;
    // Typst figures ignore an outer `align`, the figure itself must be aligned
    const align =
      textAlignment === 'center' || textAlignment === 'right'
        ? textAlignment
        : 'left';

    // As in the editor (`alt=""`), an image without a name nor a caption is
    // decorative: it is marked as an artifact, PDF/UA requiring an
    // alternative text on every figure.
    const alt = name || caption;
    if (!alt) {
      return `#align(${align}, pdf.artifact(${image}))`;
    }

    const captionArg = caption ? `, caption: [#${strLit(caption)}]` : '';

    return `#[#show figure: set align(${align}); #figure(${image}${captionArg}, alt: ${strLit(alt)})]`;
  };
