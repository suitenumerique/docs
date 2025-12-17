import {
  COLORS_DEFAULT,
  DefaultProps,
  UnreachableCaseError,
} from '@blocknote/core';
import { Canvg } from 'canvg';
import { IParagraphOptions, ShadingType } from 'docx';
import JSZip from 'jszip';
import React from 'react';

import { exportResolveFileUrl } from './api';

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

// Escape user-provided text  before injecting it into the exported HTML document.
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface MediaFilenameParams {
  src: string;
  index: number;
  blob: Blob;
}

/**
 * Derives a stable, readable filename for media exported in the HTML ZIP.
 *
 * Rules:
 * - Default base name is "media-{index+1}".
 * - For non data: URLs, we reuse the last path segment when possible (e.g. 1-photo.png).
 * - If the base name has no extension, we try to infer one from the blob MIME type.
 */
export const deriveMediaFilename = ({
  src,
  index,
  blob,
}: MediaFilenameParams): string => {
  // Default base name
  let baseName = `media-${index + 1}`;

  // Try to reuse the last path segment for non data URLs.
  if (!src.startsWith('data:')) {
    try {
      const url = new URL(src, window.location.origin);
      const lastSegment = url.pathname.split('/').pop();
      if (lastSegment) {
        baseName = `${index + 1}-${lastSegment}`;
      }
    } catch {
      // Ignore invalid URLs, keep default baseName.
    }
  }

  let filename = baseName;

  // Ensure the filename has an extension consistent with the blob MIME type.
  const mimeType = blob.type;
  if (mimeType && !baseName.includes('.')) {
    const slashIndex = mimeType.indexOf('/');
    const rawSubtype =
      slashIndex !== -1 && slashIndex < mimeType.length - 1
        ? mimeType.slice(slashIndex + 1)
        : '';

    let extension = '';
    const subtype = rawSubtype.toLowerCase();

    if (subtype.includes('svg')) {
      extension = 'svg';
    } else if (subtype.includes('jpeg') || subtype.includes('pjpeg')) {
      extension = 'jpg';
    } else if (subtype.includes('png')) {
      extension = 'png';
    } else if (subtype.includes('gif')) {
      extension = 'gif';
    } else if (subtype.includes('webp')) {
      extension = 'webp';
    } else if (subtype.includes('pdf')) {
      extension = 'pdf';
    } else if (subtype) {
      extension = subtype.split('+')[0];
    }

    if (extension) {
      filename = `${baseName}.${extension}`;
    }
  }

  return filename;
};

/**
 * Generates a complete HTML document structure for export.
 *
 * @param documentTitle - The title of the document (will be escaped)
 * @param editorHtmlWithLocalMedia - The HTML content from the editor
 * @param lang - The language code for the document (e.g., 'fr', 'en')
 * @returns A complete HTML5 document string
 */
export const generateHtmlDocument = (
  documentTitle: string,
  editorHtmlWithLocalMedia: string,
  lang: string,
): string => {
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main role="main">
${editorHtmlWithLocalMedia}
    </main>
  </body>
</html>`;
};

/**
 * Enrich the HTML produced by the editor with semantic tags and basic a11y defaults.
 *
 * Notes:
 * - We work directly on the parsed Document so modifications are reflected before we zip files.
 * - We keep the editor inner structure but upgrade the key block types to native elements.
 */
export const improveHtmlAccessibility = (
  parsedDocument: Document,
  documentTitle: string,
) => {
  const body = parsedDocument.body;
  if (!body) {
    return;
  }

  // 1) Headings: convert heading blocks to h1-h6 based on data-level
  const headingBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='heading']"),
  );

  headingBlocks.forEach((block) => {
    const rawLevel = Number(block.getAttribute('data-level')) || 1;
    const level = Math.min(Math.max(rawLevel, 1), 6);
    const heading = parsedDocument.createElement(`h${level}`);
    heading.innerHTML = block.innerHTML;
    block.replaceWith(heading);
  });

  // 2) Lists: group consecutive list items into UL/OL with LI children
  const listItemSelector =
    "[data-content-type='bulletListItem'], [data-content-type='numberedListItem']";
  const listItems = Array.from(
    body.querySelectorAll<HTMLElement>(listItemSelector),
  );

  listItems.forEach((item) => {
    const parent = item.parentElement;
    if (!parent) {
      return;
    }

    const isBullet =
      item.getAttribute('data-content-type') === 'bulletListItem';
    const listTag = isBullet ? 'ul' : 'ol';

    // If the previous sibling is already the right list, reuse it; otherwise create a new one.
    let previousSibling = item.previousElementSibling;
    let listContainer: HTMLElement | null = null;

    if (previousSibling?.tagName.toLowerCase() === listTag) {
      listContainer = previousSibling as HTMLElement;
    } else {
      listContainer = parsedDocument.createElement(listTag);
      parent.insertBefore(listContainer, item);
    }

    const li = parsedDocument.createElement('li');
    li.innerHTML = item.innerHTML;
    listContainer.appendChild(li);
    parent.removeChild(item);
  });

  // 3) Quotes -> <blockquote>
  const quoteBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='quote']"),
  );
  quoteBlocks.forEach((block) => {
    const quote = parsedDocument.createElement('blockquote');
    quote.innerHTML = block.innerHTML;
    block.replaceWith(quote);
  });

  // 4) Callouts -> <aside role="note">
  const calloutBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='callout']"),
  );
  calloutBlocks.forEach((block) => {
    const aside = parsedDocument.createElement('aside');
    aside.setAttribute('role', 'note');
    aside.innerHTML = block.innerHTML;
    block.replaceWith(aside);
  });

  // 5) Checklists -> list + checkbox semantics
  const checkListItems = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='checkListItem']"),
  );
  checkListItems.forEach((item) => {
    const parent = item.parentElement;
    if (!parent) {
      return;
    }

    let previousSibling = item.previousElementSibling;
    let listContainer: HTMLElement | null = null;

    if (previousSibling?.tagName.toLowerCase() === 'ul') {
      listContainer = previousSibling as HTMLElement;
    } else {
      listContainer = parsedDocument.createElement('ul');
      listContainer.setAttribute('role', 'list');
      parent.insertBefore(listContainer, item);
    }

    const li = parsedDocument.createElement('li');
    li.innerHTML = item.innerHTML;

    // Ensure checkbox has an accessible state; fall back to aria-checked if missing.
    const checkbox = li.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );
    if (checkbox && !checkbox.hasAttribute('aria-checked')) {
      checkbox.setAttribute(
        'aria-checked',
        checkbox.checked ? 'true' : 'false',
      );
    }

    listContainer.appendChild(li);
    parent.removeChild(item);
  });

  // 6) Code blocks -> <pre><code>
  const codeBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='codeBlock']"),
  );
  codeBlocks.forEach((block) => {
    const pre = parsedDocument.createElement('pre');
    const code = parsedDocument.createElement('code');
    code.innerHTML = block.innerHTML;
    pre.appendChild(code);
    block.replaceWith(pre);
  });

  // 7) Ensure images have alt text (empty when not provided)
  body.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (!img.hasAttribute('alt')) {
      img.setAttribute('alt', '');
    }
  });

  // 8) Wrap content in an article with a title landmark if none exists
  const existingH1 = body.querySelector('h1');
  if (!existingH1) {
    const titleHeading = parsedDocument.createElement('h1');
    titleHeading.id = 'doc-title';
    titleHeading.textContent = documentTitle;
    body.insertBefore(titleHeading, body.firstChild);
  }

  // If there is no article, group the body content inside one for better semantics.
  const hasArticle = body.querySelector('article');
  if (!hasArticle) {
    const article = parsedDocument.createElement('article');
    article.setAttribute('role', 'document');
    article.setAttribute('aria-labelledby', 'doc-title');
    while (body.firstChild) {
      article.appendChild(body.firstChild);
    }
    body.appendChild(article);
  }
};

export const addMediaFilesToZip = async (
  parsedDocument: Document,
  zip: JSZip,
  mediaUrl: string,
) => {
  const mediaFiles: { filename: string; blob: Blob }[] = [];
  const mediaElements = Array.from(
    parsedDocument.querySelectorAll<
      HTMLImageElement | HTMLVideoElement | HTMLAudioElement | HTMLSourceElement
    >('img, video, audio, source'),
  );

  await Promise.all(
    mediaElements.map(async (element, index) => {
      const src = element.getAttribute('src');

      if (!src) {
        return;
      }

      // data: URLs are already embedded and work offline; no need to create separate files.
      if (src.startsWith('data:')) {
        return;
      }

      // Only download same-origin resources (internal media like /media/...).
      // External URLs keep their original src and are not included in the ZIP
      let url: URL | null = null;
      try {
        url = new URL(src, mediaUrl);
      } catch {
        url = null;
      }

      if (!url || url.origin !== mediaUrl) {
        return;
      }

      const fetched = await exportResolveFileUrl(url.href);

      if (!(fetched instanceof Blob)) {
        return;
      }

      const filename = deriveMediaFilename({
        src: url.href,
        index,
        blob: fetched,
      });
      element.setAttribute('src', filename);
      mediaFiles.push({ filename, blob: fetched });
    }),
  );

  mediaFiles.forEach(({ filename, blob }) => {
    zip.file(filename, blob);
  });
};
