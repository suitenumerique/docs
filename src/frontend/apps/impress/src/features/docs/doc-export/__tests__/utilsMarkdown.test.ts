import JSZip from 'jszip';
import { describe, expect, test, vi } from 'vitest';

import { addMediaFilesToMarkdownZip } from '../utils_markdown';

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

    await addMediaFilesToMarkdownZip(
      blocks,
      zip,
      'https://media.test',
      resolveMedia,
    );

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

    await addMediaFilesToMarkdownZip(
      blocks,
      zip,
      'https://media.test',
      resolveMedia,
    );

    expect(resolveMedia).toHaveBeenCalledWith(
      'https://media.test/media/nested.svg',
    );
    expect(blocks[0].children[0].props.url).toBe('/media/nested.svg');
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
