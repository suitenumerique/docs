/**
 * Helpers for converting URLs from common video platforms into iframe-friendly
 * `src` URLs. Unrecognised URLs fall back to direct-video rendering, matching
 * the behaviour of BlockNote's default video block so existing documents keep
 * working unchanged.
 */

export type EmbedKind = 'iframe' | 'video';

export interface ParsedEmbed {
  kind: EmbedKind;
  src: string;
}

const YOUTUBE_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&].*)?$/;

const VIMEO_RE =
  /^(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com|player\.vimeo\.com\/video)\/(\d+)(?:[?/].*)?$/;

const LOOM_RE =
  /^(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)(?:[?/].*)?$/;

const DAILYMOTION_RE =
  /^(?:https?:\/\/)?(?:www\.)?(?:dailymotion\.com\/(?:video|embed\/video)|dai\.ly)\/([a-zA-Z0-9]+)(?:[?_].*)?$/;

const VIDEO_FILE_EXT_RE =
  /\.(mp4|webm|ogv|ogg|mov|m4v|avi|mkv)(?:\?.*)?(?:#.*)?$/i;

/**
 * Detects whether a URL points at a known embed-style platform (YouTube,
 * Vimeo, Loom, Dailymotion) and returns an iframe-ready src. URLs that look
 * like direct video files, or are unrecognised, are returned as-is and
 * rendered through the native HTML5 `<video>` element.
 */
export function parseEmbedUrl(url: string): ParsedEmbed {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return { kind: 'video', src: '' };
  }

  const ytMatch = trimmed.match(YOUTUBE_RE);
  if (ytMatch) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  const vmMatch = trimmed.match(VIMEO_RE);
  if (vmMatch) {
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vmMatch[1]}`,
    };
  }

  const loomMatch = trimmed.match(LOOM_RE);
  if (loomMatch) {
    return {
      kind: 'iframe',
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  const dmMatch = trimmed.match(DAILYMOTION_RE);
  if (dmMatch) {
    return {
      kind: 'iframe',
      src: `https://www.dailymotion.com/embed/video/${dmMatch[1]}`,
    };
  }

  if (VIDEO_FILE_EXT_RE.test(trimmed)) {
    return { kind: 'video', src: trimmed };
  }

  // Fallback: render as <video>. Keeps backwards compatibility with existing
  // documents that store signed/extension-less direct video URLs.
  return { kind: 'video', src: trimmed };
}
