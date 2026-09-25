import JSZip from 'jszip';
import { describe, expect, test, vi } from 'vitest';

import {
  addMediaFilesToMarkdownZip,
  preserveImageWidthsInMarkdown,
} from '../utils_markdown';

describe('addMediaFilesToMarkdownZip', () => {
  test('localizes same-origin media without mutating unrelated URLs', async () => {
    const blocks = [
      {
        type: 'image',
        props: { url: 'https://media.test/media/photo.png' },
      },
      {
        type: 'image',
        props: { url: 'https://external.test/photo.png' },
      },
      {
        type: 'image',
        props: { url: 'data:image/png;base64,aGVsbG8=' },
      },
    ];
    const zip = new JSZip();
    const imageBlob = new Blob(['image'], { type: 'image/png' });
    const resolveMedia = vi.fn().mockResolvedValue(imageBlob);

    const mediaFileCount = await addMediaFilesToMarkdownZip(
      blocks,
      zip,
      'https://media.test',
      resolveMedia,
    );

    expect(mediaFileCount).toBe(1);
    expect(resolveMedia).toHaveBeenCalledOnce();
    expect(resolveMedia).toHaveBeenCalledWith(
      'https://media.test/media/photo.png',
    );
    expect(blocks[0].props.url).toBe('1-photo.png');
    expect(blocks[1].props.url).toBe('https://external.test/photo.png');
    expect(blocks[2].props.url).toBe('data:image/png;base64,aGVsbG8=');
    expect(zip.file('1-photo.png')).not.toBeNull();
  });

  test('finds nested media and keeps its URL when fetching fails', async () => {
    const blocks = [
      {
        type: 'columnList',
        children: [
          {
            type: 'image',
            props: { url: '/media/nested.svg' },
          },
        ],
      },
    ];
    const zip = new JSZip();
    const resolveMedia = vi.fn().mockResolvedValue('/media/nested.svg');

    const mediaFileCount = await addMediaFilesToMarkdownZip(
      blocks,
      zip,
      'https://media.test',
      resolveMedia,
    );

    expect(mediaFileCount).toBe(0);
    expect(resolveMedia).toHaveBeenCalledWith(
      'https://media.test/media/nested.svg',
    );
    expect(blocks[0].children[0].props.url).toBe('/media/nested.svg');
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});

describe('preserveImageWidthsInMarkdown', () => {
  test('adds the CodiMD width syntax to resized images', () => {
    const markdown = preserveImageWidthsInMarkdown(
      '![Architecture](diagram.svg)',
      [
        {
          type: 'image',
          props: { url: 'diagram.svg', previewWidth: 480 },
        },
      ],
    );

    expect(markdown).toBe('![Architecture](diagram.svg =480x)');
  });

  test('preserves image URLs after they are localized for a Markdown archive', () => {
    const markdown = preserveImageWidthsInMarkdown('![](1-photo.png)', [
      {
        type: 'image',
        props: { url: '1-photo.png', previewWidth: 320 },
      },
    ]);

    expect(markdown).toBe('![](1-photo.png =320x)');
  });

  test('handles nested images and repeated URLs in document order', () => {
    const markdown = preserveImageWidthsInMarkdown(
      '![](photo.png)\n\n![](photo.png)',
      [
        {
          type: 'image',
          props: { url: 'photo.png', previewWidth: 200 },
        },
        {
          type: 'columnList',
          children: [
            {
              type: 'image',
              props: { url: 'photo.png', previewWidth: 400 },
            },
          ],
        },
      ],
    );

    expect(markdown).toBe('![](photo.png =200x)\n\n![](photo.png =400x)');
  });

  test('matches a resized image after an unresized occurrence of the same URL', () => {
    const markdown = preserveImageWidthsInMarkdown(
      '![](photo.png)\n\n![](photo.png)',
      [
        { type: 'image', props: { url: 'photo.png' } },
        { type: 'image', props: { url: 'photo.png', previewWidth: 400 } },
      ],
    );

    expect(markdown).toBe('![](photo.png)\n\n![](photo.png =400x)');
  });

  test('preserves literal dollar signs in image URLs', () => {
    const markdown = preserveImageWidthsInMarkdown('![](photo$1.png)', [
      {
        type: 'image',
        props: { url: 'photo$1.png', previewWidth: 400 },
      },
    ]);

    expect(markdown).toBe('![](photo$1.png =400x)');
  });

  test.each([undefined, 0, -1, Infinity])(
    'does not add a dimension for invalid width %s',
    (previewWidth) => {
      const markdown = preserveImageWidthsInMarkdown('![](photo.png)', [
        {
          type: 'image',
          props: { url: 'photo.png', previewWidth },
        },
      ]);

      expect(markdown).toBe('![](photo.png)');
    },
  );
});
