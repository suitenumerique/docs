import type { EmojiData } from 'frimousse';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CALLOUT_EMOJIS } from '@/docs/doc-editor/components/custom-blocks/CalloutBlock';

import {
  createResolveEmojiData,
  filterUnsupportedEmojis,
  highlightEmojis,
} from '../emojiData';

const options = { signal: new AbortController().signal };

describe('createResolveEmojiData', () => {
  it('loads the bundled data of the locale, localized', async () => {
    const data = await createResolveEmojiData()('fr', options);

    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.emojis.find(({ emoji }) => emoji === '😀')?.label).toBe(
      'Visage rieur',
    );
  });

  it('lists the highlighted emojis in a first category', async () => {
    const data = await createResolveEmojiData({
      label: 'Callout',
      emojis: CALLOUT_EMOJIS,
    })('en', options);

    expect(data.categories[0]).toEqual({ index: 0, label: 'Callout' });
    const highlighted = data.emojis.filter(({ category }) => category === 0);
    // An emoji missing from the data would silently vanish from the picker
    expect(highlighted).toHaveLength(CALLOUT_EMOJIS.length);
  });

  it('stops when the picker is unmounted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      createResolveEmojiData()('en', { signal: controller.signal }),
    ).rejects.toBeDefined();
  });
});

describe('filterUnsupportedEmojis', () => {
  const emoji = (
    value: string,
    version: number,
    countryFlag?: true,
  ): EmojiData['emojis'][number] => ({
    emoji: value,
    category: 0,
    label: value,
    version,
    tags: [],
    countryFlag,
  });

  const data: EmojiData = {
    locale: 'en',
    skinTones: {} as never,
    categories: [{ index: 0, label: 'All' }],
    emojis: [
      emoji('😀', 1),
      emoji('🙂', 1),
      emoji('🫠', 14),
      emoji('🫨', 15),
      emoji('🇫🇷', 2, true),
    ],
  };

  /** A canvas drawing only the emojis of `drawn` in color, the rest as text. */
  const stubCanvas = (drawn: string[]) => {
    let fillStyle = '';
    let text = '';
    const ctx = {
      canvas: {},
      set fillStyle(value: string) {
        fillStyle = value;
      },
      set font(_value: string) {
        // noop
      },
      set textBaseline(_value: string) {
        // noop
      },
      measureText: (value: string) => ({
        width: drawn.includes(value) ? 1 : 4,
      }),
      fillText: (value: string) => {
        text = value;
      },
      clearRect: () => undefined,
      // A color glyph ignores the fill color, a text one takes it
      getImageData: () =>
        drawn.includes(text)
          ? { data: new Uint8ClampedArray([1, 2, 3, 255]) }
          : {
              data: new Uint8ClampedArray([
                fillStyle === '#00f' ? 0 : 255,
                0,
                fillStyle === '#00f' ? 255 : 0,
                255,
              ]),
            },
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops the emojis newer than the font, and the unsupported flags', () => {
    stubCanvas(['😀', '🙂', '🫠']);

    const result = filterUnsupportedEmojis(data);

    expect(result.emojis.map(({ emoji: value }) => value)).toEqual([
      '😀',
      '🙂',
      '🫠',
    ]);
  });

  it('keeps the flags when the platform draws them', () => {
    stubCanvas(['😀', '🙂', '🫠', '🫨', '🇪🇺']);

    const result = filterUnsupportedEmojis(data);

    expect(result.emojis).toHaveLength(data.emojis.length);
  });

  it('keeps everything without a canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(filterUnsupportedEmojis(data).emojis).toHaveLength(
      data.emojis.length,
    );
  });
});

describe('highlightEmojis', () => {
  const data = {
    locale: 'en',
    skinTones: {} as never,
    categories: [
      { index: 0, label: 'Smileys' },
      { index: 1, label: 'Nature' },
    ],
    emojis: [
      { emoji: '😀', category: 0, label: 'grinning', version: 1, tags: [] },
      { emoji: '🌳', category: 1, label: 'tree', version: 1, tags: [] },
    ],
  };

  it('shifts the other categories after the highlighted one', () => {
    const result = highlightEmojis(data, { label: 'Top', emojis: ['🌳'] });

    expect(result.categories).toEqual([
      { index: 0, label: 'Top' },
      { index: 1, label: 'Smileys' },
      { index: 2, label: 'Nature' },
    ]);
    expect(result.emojis.map(({ category }) => category)).toEqual([1, 0]);
  });
});
