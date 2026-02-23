import JSZip from 'jszip';

import { isSafeUrl } from '@/utils/url';

import { exportResolveFileUrl } from './api';

// Escape user-provided text  before injecting it into the exported HTML document.
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const moveChildNodes = (from: Element, to: Element) => {
  while (from.firstChild) {
    to.appendChild(from.firstChild);
  }
};

/**
 * Derives a stable, readable filename for media exported in the HTML ZIP.
 *
 * Rules:
 * - Default base name is "media-{index+1}".
 * - For non data: URLs, we reuse the last path segment when possible (e.g. 1-photo.png).
 * - If the base name has no extension, we try to infer one from the blob MIME type.
 */

interface MediaFilenameParams {
  src: string;
  index: number;
  blob: Blob;
}

export const deriveMediaFilename = ({
  src,
  index,
  blob,
}: MediaFilenameParams): string => {
  // Default base name
  let baseName = `media-${index + 1}`;

  // Try to reuse the last path segment for non data URLs.
  if (!src.startsWith('data:')) {
    try {
      const url = new URL(src, window.location.origin);
      const lastSegment = url.pathname.split('/').pop();
      if (lastSegment) {
        baseName = `${index + 1}-${lastSegment}`;
      }
    } catch {
      // Ignore invalid URLs, keep default baseName.
    }
  }

  let filename = baseName;

  // Ensure the filename has an extension consistent with the blob MIME type.
  const mimeType = blob.type;
  if (mimeType && !baseName.includes('.')) {
    const slashIndex = mimeType.indexOf('/');
    const rawSubtype =
      slashIndex !== -1 && slashIndex < mimeType.length - 1
        ? mimeType.slice(slashIndex + 1)
        : '';

    let extension = '';
    const subtype = rawSubtype.toLowerCase();

    if (subtype.includes('svg')) {
      extension = 'svg';
    } else if (subtype.includes('jpeg') || subtype.includes('pjpeg')) {
      extension = 'jpg';
    } else if (subtype.includes('png')) {
      extension = 'png';
    } else if (subtype.includes('gif')) {
      extension = 'gif';
    } else if (subtype.includes('webp')) {
      extension = 'webp';
    } else if (subtype.includes('pdf')) {
      extension = 'pdf';
    } else if (subtype) {
      extension = subtype.split('+')[0];
    }

    if (extension) {
      filename = `${baseName}.${extension}`;
    }
  }

  return filename;
};

/**
 * Generates a complete HTML document structure for export.
 *
 * @param documentTitle - The title of the document (will be escaped)
 * @param editorHtmlWithLocalMedia - The HTML content from the editor
 * @param lang - The language code for the document (e.g., 'fr', 'en')
 * @returns A complete HTML5 document string
 */
export const generateHtmlDocument = (
  documentTitle: string,
  editorHtmlWithLocalMedia: string,
  lang: string,
): string => {
  return `<!DOCTYPE html>
  <html lang="${lang}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(documentTitle)}</title>
      <link rel="stylesheet" href="styles.css">
    </head>
    <body>
      <main role="main">
  ${editorHtmlWithLocalMedia}
      </main>
    </body>
  </html>`;
};

/**
 * Enrich the HTML produced by the editor with semantic tags and basic a11y defaults.
 *
 * Notes:
 * - We work directly on the parsed Document so modifications are reflected before we zip files.
 * - We keep the editor inner structure but upgrade the key block types to native elements.
 */
export const improveHtmlAccessibility = (
  parsedDocument: Document,
  documentTitle: string,
) => {
  const body = parsedDocument.body;
  if (!body) {
    return;
  }

  // 1) Headings: convert heading blocks to h1-h6 based on data-level
  const headingBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='heading']"),
  );

  headingBlocks.forEach((block) => {
    const rawLevel = Number(block.getAttribute('data-level')) || 1;
    const level = Math.min(Math.max(rawLevel, 1), 6);
    const heading = parsedDocument.createElement(`h${level}`);
    moveChildNodes(block, heading);
    block.replaceWith(heading);
  });

  // 2) Lists: convert to semantic OL/UL/LI elements for accessibility
  const listItemSelector =
    "[data-content-type='bulletListItem'], [data-content-type='numberedListItem']";

  // Helper function to get nesting level by counting block-group ancestors
  const getNestingLevel = (blockOuter: HTMLElement): number => {
    let level = 0;
    let parent = blockOuter.parentElement;
    while (parent) {
      if (parent.classList.contains('bn-block-group')) {
        level++;
      }
      parent = parent.parentElement;
    }
    return level;
  };

  // Find all block-outer elements in document order
  const allBlockOuters = Array.from(
    body.querySelectorAll<HTMLElement>('.bn-block-outer'),
  );

  // Collect list items with their info before modifying DOM
  interface ListItemInfo {
    blockOuter: HTMLElement;
    listItem: HTMLElement;
    contentType: string;
    level: number;
  }

  const listItemsInfo: ListItemInfo[] = [];
  allBlockOuters.forEach((blockOuter) => {
    const listItem = blockOuter.querySelector<HTMLElement>(listItemSelector);
    if (listItem) {
      const contentType = listItem.getAttribute('data-content-type');
      if (contentType) {
        const level = getNestingLevel(blockOuter);
        listItemsInfo.push({
          blockOuter,
          listItem,
          contentType,
          level,
        });
      }
    }
  });

  // Stack to track lists at each nesting level
  const listStack: Array<{ list: HTMLElement; type: string; level: number }> =
    [];

  listItemsInfo.forEach((info, idx) => {
    const { blockOuter, listItem, contentType, level } = info;
    const isBullet = contentType === 'bulletListItem';
    const listTag = isBullet ? 'ul' : 'ol';

    // Check if previous item continues the same list (same type and level)
    const previousInfo = idx > 0 ? listItemsInfo[idx - 1] : null;
    const continuesPreviousList =
      previousInfo &&
      previousInfo.contentType === contentType &&
      previousInfo.level === level;

    // Find or create the appropriate list
    let targetList: HTMLElement | null = null;

    if (continuesPreviousList) {
      // Continue with the list at this level from stack
      const listAtLevel = listStack.find((item) => item.level === level);
      targetList = listAtLevel?.list || null;
    }

    // If no list found, create a new one
    if (!targetList) {
      targetList = parsedDocument.createElement(listTag);

      // Remove lists from stack that are at same or deeper level
      while (
        listStack.length > 0 &&
        listStack[listStack.length - 1].level >= level
      ) {
        listStack.pop();
      }

      // If we have a parent list, nest this list inside its last li
      if (
        listStack.length > 0 &&
        listStack[listStack.length - 1].level < level
      ) {
        const parentList = listStack[listStack.length - 1].list;
        const lastLi = parentList.querySelector('li:last-child');
        if (lastLi) {
          lastLi.appendChild(targetList);
        } else {
          // No li yet, create one and add the nested list
          const li = parsedDocument.createElement('li');
          parentList.appendChild(li);
          li.appendChild(targetList);
        }
      } else {
        // Top-level list
        blockOuter.parentElement?.insertBefore(targetList, blockOuter);
      }

      // Add to stack
      listStack.push({ list: targetList, type: contentType, level });
    }

    // Create list item and add content
    const li = parsedDocument.createElement('li');
    moveChildNodes(listItem, li);
    targetList.appendChild(li);

    // Remove original block-outer
    blockOuter.remove();
  });

  // 3) Quotes -> <blockquote>
  const quoteBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='quote']"),
  );
  quoteBlocks.forEach((block) => {
    const quote = parsedDocument.createElement('blockquote');
    moveChildNodes(block, quote);
    block.replaceWith(quote);
  });

  // 4) Callouts -> <aside role="note">
  const calloutBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='callout']"),
  );
  calloutBlocks.forEach((block) => {
    const aside = parsedDocument.createElement('aside');
    aside.setAttribute('role', 'note');
    moveChildNodes(block, aside);
    block.replaceWith(aside);
  });

  // 5) Checklists -> list + checkbox semantics
  const checkListItems = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='checkListItem']"),
  );
  checkListItems.forEach((item) => {
    const parent = item.parentElement;
    if (!parent) {
      return;
    }

    let previousSibling = item.previousElementSibling;
    let listContainer: HTMLElement | null;

    if (previousSibling?.tagName.toLowerCase() === 'ul') {
      listContainer = previousSibling as HTMLElement;
    } else {
      listContainer = parsedDocument.createElement('ul');
      listContainer.setAttribute('role', 'list');
      listContainer.classList.add('checklist');
      parent.insertBefore(listContainer, item);
    }

    const li = parsedDocument.createElement('li');
    moveChildNodes(item, li);

    // Ensure checkbox has an accessible state; fall back to aria-checked if missing.
    const checkbox = li.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );
    if (checkbox && !checkbox.hasAttribute('aria-checked')) {
      checkbox.setAttribute(
        'aria-checked',
        checkbox.checked ? 'true' : 'false',
      );
    }

    listContainer.appendChild(li);
    parent.removeChild(item);
  });

  // 6) Code blocks -> <pre><code>
  const codeBlocks = Array.from(
    body.querySelectorAll<HTMLElement>("[data-content-type='codeBlock']"),
  );
  codeBlocks.forEach((block) => {
    const pre = parsedDocument.createElement('pre');
    const code = parsedDocument.createElement('code');

    // Preserve existing classes/attributes so the exported CSS (dark theme) still applies.
    pre.className = block.className || '';
    pre.setAttribute('data-content-type', 'codeBlock');

    // Copy other data attributes from the original block to the new <pre>.
    Array.from(block.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-') && attr.name !== 'data-content-type') {
        pre.setAttribute(attr.name, attr.value);
      }
    });

    // Move content inside <code>.
    moveChildNodes(block, code);
    pre.appendChild(code);
    block.replaceWith(pre);
  });

  // 7) Ensure images have alt text (empty when not provided)
  body.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (!img.hasAttribute('alt')) {
      img.setAttribute('alt', '');
    }
  });

  // 8) Wrap content in an article with a title landmark if none exists
  const existingH1 = body.querySelector('h1');
  if (!existingH1) {
    const titleHeading = parsedDocument.createElement('h1');
    titleHeading.id = 'doc-title';
    titleHeading.textContent = documentTitle;
    body.insertBefore(titleHeading, body.firstChild);
  }

  // If there is no article, group the body content inside one for better semantics.
  const hasArticle = body.querySelector('article');
  if (!hasArticle) {
    const article = parsedDocument.createElement('article');
    article.setAttribute('role', 'document');
    article.setAttribute('aria-labelledby', 'doc-title');
    while (body.firstChild) {
      article.appendChild(body.firstChild);
    }
    body.appendChild(article);
  }
};

export const addMediaFilesToZip = async (
  parsedDocument: Document,
  zip: JSZip,
  mediaUrl: string,
) => {
  const mediaFiles: { filename: string; blob: Blob }[] = [];
  const mediaElements = Array.from(
    parsedDocument.querySelectorAll<
      HTMLImageElement | HTMLVideoElement | HTMLAudioElement | HTMLSourceElement
    >('img, video, audio, source'),
  );

  await Promise.all(
    mediaElements.map(async (element, index) => {
      const src = element.getAttribute('src');

      if (!src) {
        return;
      }

      // data: URLs are already embedded and work offline; no need to create separate files.
      if (src.startsWith('data:')) {
        return;
      }

      // Only download same-origin resources (internal media like /media/...).
      // External URLs keep their original src and are not included in the ZIP
      let url: URL | null;
      try {
        url = new URL(src, mediaUrl);
      } catch {
        url = null;
      }

      if (!url || url.origin !== mediaUrl || !isSafeUrl(url.href)) {
        return;
      }

      const fetched = await exportResolveFileUrl(url.href);

      if (!(fetched instanceof Blob)) {
        return;
      }

      const filename = deriveMediaFilename({
        src: url.href,
        index,
        blob: fetched,
      });
      element.setAttribute('src', filename);
      mediaFiles.push({ filename, blob: fetched });
    }),
  );

  mediaFiles.forEach(({ filename, blob }) => {
    zip.file(filename, blob);
  });
};
