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

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function getYouTubeId(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const path = parsed.pathname;

  if (host === 'youtu.be') {
    const id = path.split('/').filter(Boolean)[0] ?? '';
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }

  if (host === 'youtube.com') {
    if (path === '/watch') {
      const id = parsed.searchParams.get('v') ?? '';
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }
    const prefixed = ['/embed/', '/v/', '/shorts/'].find((p) =>
      path.startsWith(p),
    );
    if (prefixed) {
      const id = path.slice(prefixed.length).split('/')[0] ?? '';
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }
  }

  return null;
}

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

  const ytId = getYouTubeId(trimmed);
  if (ytId) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${ytId}`,
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
