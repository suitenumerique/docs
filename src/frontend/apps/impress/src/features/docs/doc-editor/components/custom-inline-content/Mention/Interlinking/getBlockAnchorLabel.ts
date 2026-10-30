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
        text += inline.text ?? '';
      } else if (inline.type === 'link') {
        // A link holds styled texts, any other inline content (mention,
        // interlink, ...) has no text to show.
        collect(inline.content);
      }

      return text.trimEnd().length > maxChars;
    });

  collect(content);

  return text;
};

/**
 * Text of the block `blockId` of the editor, cut to `maxWords` words
 * (an ellipsis tells it was cut). Returns null when the block does not exist
 * (yet) or holds no text (image, table, divider, ...).
 */
export const getBlockAnchorLabel = (
  editor: DocsBlockNoteEditor,
  blockId: string,
  maxWords = BLOCK_ANCHOR_LABEL_MAX_WORDS,
): string | null => {
  const block = editor.getBlock(blockId);
  if (!block) {
    return null;
  }

  const text = getInlineText(block.content, BLOCK_ANCHOR_LABEL_MAX_CHARS);
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
