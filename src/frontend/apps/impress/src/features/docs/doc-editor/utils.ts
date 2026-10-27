import { validate as uuidValidate } from 'uuid';

import { DocsBlockNoteEditor } from './types';

export const DOC_PATH_REGEX = /^\/docs\/([^/]+)\/?$/;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const getWordCount = (editor?: DocsBlockNoteEditor): number => {
  const doc = editor?._tiptapEditor?.state.doc;
  const text = doc ? doc.textBetween(0, doc.content.size, '\n') : '';
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export const sanitizeColor = (color: string): string => {
  return HEX_COLOR_REGEX.test(color) ? color : randomColor();
};

export const randomColor = () => {
  const randomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const h = randomInt(0, 360); // hue
  const s = randomInt(42, 98); // saturation
  const l = randomInt(70, 90); // lightness

  return hslToHex(h, s, l);
};

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns the doc id and block id of a link pointing to a document
 * on this same origin, or null for any other link (external, attachments...).
 */
export const getDocLink = (
  href: string,
): { docId: string; blockId?: string } | null => {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) {
    return null;
  }

  const docId = DOC_PATH_REGEX.exec(url.pathname)?.[1];
  if (!docId || !uuidValidate(docId)) {
    return null;
  }

  const blockId = url.hash.slice(1) || undefined;

  return blockId ? { docId, blockId } : { docId };
};
