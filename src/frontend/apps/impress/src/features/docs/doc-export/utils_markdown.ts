import JSZip from 'jszip';

import { isSafeUrl } from '@/utils/url';

import { exportResolveFileUrl } from './api';
import { deriveMediaFilename } from './utils_html';

type MediaResolver = (url: string) => Promise<Blob | string>;

interface MediaReference {
  props: Record<string, unknown>;
  src: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
): Promise<void> => {
  const references: MediaReference[] = [];
  collectMediaReferences(blocks, references);

  let mediaOrigin: string;
  try {
    mediaOrigin = new URL(mediaUrl).origin;
  } catch {
    return;
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

  mediaFiles.forEach((mediaFile) => {
    if (mediaFile) {
      zip.file(mediaFile.filename, mediaFile.blob);
    }
  });
};
