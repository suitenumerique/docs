import JSZip from 'jszip';

import { isSafeUrl } from '@/utils/url';

import { exportResolveFileUrl } from './api';
import { deriveMediaFilename } from './utils_html';

type MediaResolver = (url: string) => Promise<Blob | string>;

interface MediaReference {
  props: Record<string, unknown>;
  src: string;
}

interface ResizedImageReference {
  src: string;
  width: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collectResizedImageReferences = (
  blocks: unknown[],
  references: ResizedImageReference[],
) => {
  blocks.forEach((block) => {
    if (!isRecord(block)) {
      return;
    }

    const props = block.props;
    if (
      block.type === 'image' &&
      isRecord(props) &&
      typeof props.url === 'string' &&
      typeof props.previewWidth === 'number' &&
      Number.isFinite(props.previewWidth) &&
      props.previewWidth > 0
    ) {
      references.push({ src: props.url, width: props.previewWidth });
    }

    if (Array.isArray(block.children)) {
      collectResizedImageReferences(block.children, references);
    }
  });
};

/**
 * Preserves BlockNote image widths using CodiMD's Markdown image-size syntax.
 * BlockNote stores the height implicitly from the image's aspect ratio, so the
 * exported syntax intentionally specifies only the width (`=WIDTHx`).
 */
export const preserveImageWidthsInMarkdown = (
  markdown: string,
  blocks: unknown[],
) => {
  const references: ResizedImageReference[] = [];
  collectResizedImageReferences(blocks, references);

  return references.reduce((result, { src, width }) => {
    const image = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(src)}\\)`);
    return result.replace(image, `![$1](${src} =${width}x)`);
  }, markdown);
};

/** Collects media URL properties from a nested editor block tree. */
const collectMediaReferences = (
  blocks: unknown[],
  references: MediaReference[],
) => {
  blocks.forEach((block) => {
    if (!isRecord(block)) {
      return;
    }

    const props = block.props;
    if (isRecord(props) && typeof props.url === 'string' && props.url) {
      references.push({ props, src: props.url });
    }

    if (Array.isArray(block.children)) {
      collectMediaReferences(block.children, references);
    }
  });
};

/**
 * Adds resolvable same-origin media to a Markdown archive and rewrites the
 * corresponding block URLs to archive-local filenames.
 */
export const addMediaFilesToMarkdownZip = async (
  blocks: unknown[],
  zip: JSZip,
  mediaUrl: string,
  resolveMedia: MediaResolver = exportResolveFileUrl,
): Promise<number> => {
  const references: MediaReference[] = [];
  collectMediaReferences(blocks, references);

  let mediaOrigin: string;
  try {
    mediaOrigin = new URL(mediaUrl).origin;
  } catch {
    return 0;
  }

  const mediaFiles = await Promise.all(
    references.map(async ({ props, src }, index) => {
      if (src.startsWith('data:')) {
        return null;
      }

      let url: URL;
      try {
        url = new URL(src, mediaUrl);
      } catch {
        return null;
      }

      if (url.origin !== mediaOrigin || !isSafeUrl(url.href)) {
        return null;
      }

      const blob = await resolveMedia(url.href);
      if (!(blob instanceof Blob)) {
        return null;
      }

      const filename = deriveMediaFilename({
        src: url.href,
        index,
        blob,
      });

      props.url = filename;
      return { filename, blob };
    }),
  );

  let mediaFileCount = 0;
  mediaFiles.forEach((mediaFile) => {
    if (mediaFile) {
      zip.file(mediaFile.filename, mediaFile.blob);
      mediaFileCount += 1;
    }
  });

  return mediaFileCount;
};
