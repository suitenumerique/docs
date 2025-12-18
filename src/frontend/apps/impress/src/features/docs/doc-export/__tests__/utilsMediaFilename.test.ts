import { deriveMediaFilename } from '../utils_html';

describe('deriveMediaFilename', () => {
  test('uses last URL segment when src is a valid URL', () => {
    const result = deriveMediaFilename({
      src: 'https://example.com/path/video.mp4',
      index: 0,
      blob: new Blob([], { type: 'video/mp4' }),
    });
    expect(result).toBe('1-video.mp4');
  });

  test('handles URLs with query/hash and keeps the last segment', () => {
    const result = deriveMediaFilename({
      src: 'https://site.com/assets/file.name.svg?x=1#test',
      index: 0,
      blob: new Blob([], { type: 'image/svg+xml' }),
    });
    expect(result).toBe('1-file.name.svg');
  });

  test('handles relative URLs using last segment', () => {
    const result = deriveMediaFilename({
      src: 'not a valid url',
      index: 0,
      blob: new Blob([], { type: 'image/png' }),
    });
    // "not a valid url" becomes a relative URL, so we get the last segment
    expect(result).toBe('1-not%20a%20valid%20url.png');
  });

  test('data URLs always use media-{index+1}', () => {
    const result = deriveMediaFilename({
      src: 'data:image/png;base64,xxx',
      index: 0,
      blob: new Blob([], { type: 'image/png' }),
    });
    expect(result).toBe('media-1.png');
  });

  test('adds extension from MIME when baseName has no extension', () => {
    const result = deriveMediaFilename({
      src: 'https://a.com/abc',
      index: 0,
      blob: new Blob([], { type: 'image/webp' }),
    });
    expect(result).toBe('1-abc.webp');
  });

  test('does not override extension if baseName already contains one', () => {
    const result = deriveMediaFilename({
      src: 'https://a.com/image.png',
      index: 0,
      blob: new Blob([], { type: 'image/jpeg' }),
    });
    expect(result).toBe('1-image.png');
  });

  test('handles complex MIME types (e.g., audio/mpeg)', () => {
    const result = deriveMediaFilename({
      src: 'https://a.com/song',
      index: 1,
      blob: new Blob([], { type: 'audio/mpeg' }),
    });
    expect(result).toBe('2-song.mpeg');
  });
});
