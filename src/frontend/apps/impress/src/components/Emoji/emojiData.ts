import { loadFrimousseData } from '@blocknote/core/emoji-data';
import type { EmojiData, EmojiDataResolver } from 'frimousse';

export interface HighlightedEmojis {
  label: string;
  emojis: string[];
}

// The fonts BlockNote draws its emojis with.
const EMOJI_FONTS =
  "'Apple Color Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', 'Android Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', EmojiSymbols, sans-serif";

/**
 * Whether the browser draws the emoji with an emoji font. It is drawn twice on
 * a tiny canvas, in blue then red: a color glyph looks the same both times,
 * whereas a missing one falls back to a text glyph that takes the fill color.
 * An unsupported flag or sequence is also measured as several glyphs.
 */
const isEmojiRendered = (
  ctx: CanvasRenderingContext2D | null,
  emoji: string,
) => {
  if (!ctx) {
    return true;
  }

  const size = 2;
  ctx.canvas.width = size;
  ctx.canvas.height = size;
  ctx.font = `${size}px ${EMOJI_FONTS}`;
  ctx.textBaseline = 'middle';

  if (ctx.measureText(emoji).width >= size * 2) {
    return false;
  }

  ctx.fillStyle = '#00f';
  ctx.fillText(emoji, 0, 0);
  const blue = ctx.getImageData(0, 0, size, size).data;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#f00';
  ctx.fillText(emoji, 0, 0);
  const red = ctx.getImageData(0, 0, size, size).data;

  for (let i = 0; i < blue.length; i += 4) {
    if (
      blue[i] !== red[i] ||
      blue[i + 1] !== red[i + 1] ||
      blue[i + 2] !== red[i + 2]
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Hides what the platform cannot draw, as Frimousse does not filter custom data:
 * the emojis newer than its emoji font, and the flags (Windows shows letters).
 */
export const filterUnsupportedEmojis = (data: EmojiData): EmojiData => {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true });
  } catch {
    // No canvas: keep everything.
  }

  const emojiByVersion = new Map<number, string>();
  data.emojis.forEach(({ version, emoji }) => {
    if (!emojiByVersion.has(version)) {
      emojiByVersion.set(version, emoji);
    }
  });

  // One sample per Unicode version, to find the newest one the font knows.
  // If none renders (no emoji font, or a canvas read blocked) keep everything,
  // as Frimousse does: an empty picker would be worse than imperfect glyphs.
  const versions = [...emojiByVersion.keys()].sort((a, b) => b - a);
  const supportedVersion =
    versions.find((version) =>
      isEmojiRendered(ctx, emojiByVersion.get(version) as string),
    ) ?? versions[0];
  const hasFlags = isEmojiRendered(ctx, '🇪🇺');

  return {
    ...data,
    emojis: data.emojis.filter(
      ({ version, countryFlag }) =>
        version <= supportedVersion && (!countryFlag || hasFlags),
    ),
  };
};

// The data has the variation selector on some emojis and not on others, so
// compare without it.
const VARIATION_SELECTOR = String.fromCharCode(0xfe0f);
const withoutVariationSelector = (emoji: string) =>
  emoji.replaceAll(VARIATION_SELECTOR, '');

/**
 * Moves the given emojis to a new first category. Categories are referred to
 * by index, hence the shift of the others.
 */
export const highlightEmojis = (
  data: EmojiData,
  { label, emojis }: HighlightedEmojis,
): EmojiData => {
  const highlighted = new Set(emojis.map(withoutVariationSelector));

  return {
    ...data,
    categories: [
      { index: 0, label },
      ...data.categories.map((category) => ({
        ...category,
        index: category.index + 1,
      })),
    ],
    emojis: data.emojis.map((emoji) => ({
      ...emoji,
      category: highlighted.has(withoutVariationSelector(emoji.emoji))
        ? 0
        : emoji.category + 1,
    })),
  };
};

/**
 * Frimousse fetches its data from a CDN by default. This resolver uses the data
 * bundled with BlockNote, loaded on demand per locale: no third party is called.
 */
export const createResolveEmojiData =
  (highlighted?: HighlightedEmojis): EmojiDataResolver =>
  async (locale, { signal }) => {
    const data = await loadFrimousseData(locale);
    signal?.throwIfAborted();

    const supported = filterUnsupportedEmojis(data);

    return highlighted ? highlightEmojis(supported, highlighted) : supported;
  };
