import { describe, expect, it } from 'vitest';

import { parseEmbedUrl } from '@/utils/embed';

describe('parseEmbedUrl', () => {
  describe('YouTube', () => {
    const cases: [string, string][] = [
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://youtu.be/dQw4w9WgXcQ?si=token123', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=60s', 'dQw4w9WgXcQ'],
    ];

    it.each(cases)('rewrites %s to embed iframe', (input, expectedId) => {
      expect(parseEmbedUrl(input)).toEqual({
        kind: 'iframe',
        src: `https://www.youtube.com/embed/${expectedId}`,
      });
    });
  });

  describe('Vimeo', () => {
    it('rewrites vimeo.com/{id} to player URL', () => {
      expect(parseEmbedUrl('https://vimeo.com/123456789')).toEqual({
        kind: 'iframe',
        src: 'https://player.vimeo.com/video/123456789',
      });
    });

    it('keeps already-embed Vimeo URLs', () => {
      expect(parseEmbedUrl('https://player.vimeo.com/video/123456789')).toEqual(
        {
          kind: 'iframe',
          src: 'https://player.vimeo.com/video/123456789',
        },
      );
    });
  });

  describe('Loom', () => {
    it('rewrites loom.com/share/{id} to embed URL', () => {
      expect(parseEmbedUrl('https://www.loom.com/share/abcdef123456')).toEqual({
        kind: 'iframe',
        src: 'https://www.loom.com/embed/abcdef123456',
      });
    });

    it('keeps already-embed Loom URLs', () => {
      expect(parseEmbedUrl('https://www.loom.com/embed/abcdef123456')).toEqual({
        kind: 'iframe',
        src: 'https://www.loom.com/embed/abcdef123456',
      });
    });
  });

  describe('Dailymotion', () => {
    it('rewrites dailymotion.com/video/{id} to embed URL', () => {
      expect(
        parseEmbedUrl('https://www.dailymotion.com/video/x9zyxwv'),
      ).toEqual({
        kind: 'iframe',
        src: 'https://www.dailymotion.com/embed/video/x9zyxwv',
      });
    });

    it('rewrites dai.ly short URLs', () => {
      expect(parseEmbedUrl('https://dai.ly/x9zyxwv')).toEqual({
        kind: 'iframe',
        src: 'https://www.dailymotion.com/embed/video/x9zyxwv',
      });
    });
  });

  describe('Direct video files', () => {
    it.each([
      'https://example.com/clip.mp4',
      'https://example.com/clip.webm',
      'https://example.com/clip.ogg',
      'https://example.com/clip.ogv',
      'https://example.com/clip.mov',
      'https://example.com/clip.m4v',
      'https://example.com/path/to/clip.mp4?token=abc&exp=123',
      'https://example.com/path/to/clip.mp4#t=10',
    ])('renders %s as <video>', (url) => {
      expect(parseEmbedUrl(url)).toEqual({ kind: 'video', src: url });
    });
  });

  describe('Fallback (unrecognised URLs)', () => {
    it('renders unknown URLs as <video> for backwards compatibility', () => {
      expect(parseEmbedUrl('https://cdn.example.com/signed/abc123')).toEqual({
        kind: 'video',
        src: 'https://cdn.example.com/signed/abc123',
      });
    });

    it('handles empty string', () => {
      expect(parseEmbedUrl('')).toEqual({ kind: 'video', src: '' });
    });

    it('trims whitespace before parsing', () => {
      expect(parseEmbedUrl('  https://youtu.be/dQw4w9WgXcQ  ')).toEqual({
        kind: 'iframe',
        src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      });
    });
  });
});
