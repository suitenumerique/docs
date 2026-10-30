import { type TFunction } from 'i18next';

import { type DocsBlockNoteEditor } from '@/docs/doc-editor/types';

export const BLOCK_ANCHOR_LABEL_MAX_WORDS = 5;

/**
 * Only the start of a block is read: the label needs a few words, and a
 * block can hold a whole chapter.
 */
export const BLOCK_ANCHOR_LABEL_MAX_CHARS = 300;

type InlineLike = {
  type: string;
  text?: string;
  content?: unknown;
};

/**
 * Text of the inline content, read until it is longer than `maxChars`.
 */
const getInlineText = (content: unknown, maxChars: number): string => {
  let text = '';

  const collect = (inlines: unknown) =>
    Array.isArray(inlines) &&
    (inlines as InlineLike[]).some((inline) => {
      if (inline.type === 'text') {
        // The start of a long node is enough to fill the label. The leading
        // whitespace is dropped as `cropText` would, so it does not eat the
        // window.
        const nodeText = inline.text ?? '';
        text += (text.trim() ? nodeText : nodeText.trimStart()).slice(
          0,
          maxChars + 1,
        );
      } else if (inline.type === 'link') {
        // A link holds styled texts, any other inline content (mention,
        // interlink, ...) has no text to show.
        collect(inline.content);
      }

      return text.trim().length > maxChars;
    });

  collect(content);

  return text;
};

/**
 * First words of a text (an ellipsis tells it was cut), null when it holds
 * nothing but whitespace.
 */
const cropText = (rawText: string, maxWords: number): string | null => {
  // Leading whitespace must not eat the window
  const text = rawText.trimStart();
  const words = text
    .slice(0, BLOCK_ANCHOR_LABEL_MAX_CHARS)
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return null;
  }

  const label = words.slice(0, maxWords).join(' ');
  const isCut =
    words.length > maxWords ||
    text.trimEnd().length > BLOCK_ANCHOR_LABEL_MAX_CHARS;

  return isCut ? `${label}…` : label;
};

const cropInline = (content: unknown, maxWords: number) =>
  cropText(getInlineText(content, BLOCK_ANCHOR_LABEL_MAX_CHARS), maxWords);

/**
 * Name of the type of a block, for the blocks that have nothing to read.
 * The calls to `t` are literals so that the strings are extracted.
 */
const getBlockTypeLabel = (type: string, t: TFunction): string | null => {
  switch (type) {
    case 'codeBlock':
      return t('Code block');
    case 'mathBlock':
      return t('Math');
    case 'diagram':
      return t('Diagram');
    case 'divider':
      return t('Separator');
    case 'pageBreak':
      return t('Page break');
    case 'image':
      return t('Image');
    case 'video':
      return t('Video');
    case 'audio':
      return t('Audio');
    case 'file':
      return t('File');
    case 'pdf':
      return t('PDF');
    case 'table':
      return t('Table');
    default:
      return null;
  }
};

type TableLike = { rows?: { cells?: unknown[] }[] };

/** Text of the first cell of a table (a cell is its inline content or holds it) */
const getFirstCellContent = (content: unknown) => {
  const cell = (content as TableLike)?.rows?.[0]?.cells?.[0];

  return Array.isArray(cell) ? cell : (cell as InlineLike | undefined)?.content;
};

export type BlockAnchorLabel = {
  text: string;
  /** The text is a name made up for a block with nothing to read */
  isFallback: boolean;
};

const fromBlock = (text: string | null): BlockAnchorLabel | null =>
  text ? { text, isFallback: false } : null;

const fallback = (text: string | null): BlockAnchorLabel | null =>
  text ? { text, isFallback: true } : null;

/**
 * Label of the block `blockId` of the editor:
 * - its text, cut to `maxWords` words;
 * - for a block without text, what identifies it: the caption (the user
 *   controls it) or else the name of a media or file, the first cell of a
 *   table, otherwise the name of its type ("Empty block" for a text block
 *   with nothing in it). Only the name of the type is a `fallback`.
 * Returns null when there is nothing to name (a block without inline
 * content), and undefined when the block does not exist (it was deleted, or
 * the id is unknown).
 */
export const getBlockAnchorLabel = (
  editor: DocsBlockNoteEditor,
  blockId: string,
  t: TFunction,
  maxWords = BLOCK_ANCHOR_LABEL_MAX_WORDS,
): BlockAnchorLabel | null | undefined => {
  const block = editor.getBlock(blockId);
  if (!block) {
    return undefined;
  }

  const typeLabel = getBlockTypeLabel(block.type, t);
  const props = block.props as { caption?: string; name?: string };

  switch (block.type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
    case 'pdf':
      // The caption is written by the user, the name comes from the upload.
      // Both are cropped like a text: a file name can be long.
      return (
        fromBlock(cropText(props.caption ?? '', maxWords)) ||
        fromBlock(cropText(props.name ?? '', maxWords)) ||
        fallback(typeLabel)
      );
    case 'table':
      return (
        fromBlock(cropInline(getFirstCellContent(block.content), maxWords)) ||
        fallback(typeLabel)
      );
    case 'codeBlock':
    case 'mathBlock':
    case 'diagram':
    case 'divider':
    case 'pageBreak':
      return fallback(typeLabel);
    default: {
      const label = fromBlock(cropInline(block.content, maxWords));
      if (label) {
        return label;
      }

      // A block that takes text but holds none is empty, a block with no
      // inline content at all (e.g. the sub-docs list) has nothing to name.
      return Array.isArray(block.content) ? fallback(t('Empty block')) : null;
    }
  }
};
