import { isSafeUrl } from '@/utils/url';

const PRINT_ONLY_CONTENT_STYLES_ID = 'print-only-content-styles';
const PRINT_APPLY_DELAY_MS = 200;
const PRINT_CLEANUP_DELAY_MS = 1000;
const PRINT_ONLY_CONTENT_CSS = `
@media print {
  /* Reset body and html for proper pagination */
  html, body {
    height: auto !important;
    overflow: visible !important;
    background: var(--c--theme--colors--greyscale-000) !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Hide non-essential elements for printing */
  .--docs--header,
  .--docs--floating-bar,
  .--docs--resizable-left-panel,
  .--docs--doc-editor-header,
  .--docs--doc-header,
  .--docs--doc-toolbox,
  .--docs--table-content,
  .--docs--doc-footer,
  .--docs--footer,
  footer,
  [role="contentinfo"],
  div[data-is-empty-and-focused="true"],
  div[data-floating-ui-focusable],
  .collaboration-cursor-custom__base
   {
    display: none !important;
  }

  /* Hide selection highlights */
  .ProseMirror-yjs-selection {
    background-color: transparent !important;
  }

  /* Reset all layout containers for print flow */
  .--docs--main-layout,
  .--docs--main-layout > *,
  main[role="main"],
  #mainContent {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    background: var(--c--theme--colors--greyscale-000) !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Prevent any ancestor from clipping the end of the document */
  .--docs--main-layout,
  .--docs--main-layout * {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Allow editor containers to flow across pages */
  .--docs--editor-container,
  .--docs--doc-editor,
  .--docs--doc-editor-content {
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Reset all Box components that might have height constraints */
  .--docs--doc-editor > div,
  .--docs--doc-editor-content > div {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* Ensure BlockNote content flows properly */
  .bn-editor,
  .bn-container,
  .--docs--main-editor,
  .bn-block-outer {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /* Hide media/embed placeholders and render their URLs */
  [data-content-type="file"] .bn-file-block-content-wrapper, 
  [data-content-type="pdf"] .bn-file-block-content-wrapper, 
  [data-content-type="audio"] .bn-file-block-content-wrapper, 
  [data-content-type="video"] .bn-file-block-content-wrapper {
    display: none !important;
  }

  div[data-page-break] {
    opacity: 0;
  }

  /* Allow large blocks/media to split across pages */
  .bn-block-content {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .--docs--main-editor {
    width: 100% !important;
    padding: 0.5cm !important;
  }

  /* Force print all colors and backgrounds */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  /* Add minimal print margins */
  @page {
    margin: 0cm;
    margin-bottom: 0.7cm;
    margin-top: 0.7cm;
    page-break-after: always;
  }

  .print-url-label {
    text-decoration: none !important;
  }
}
`;

/**
 * Removes the print-only styles from the document head if they exist.
 */
function removePrintOnlyStyles() {
  const stylesElement = document.getElementById(PRINT_ONLY_CONTENT_STYLES_ID);
  if (stylesElement) {
    stylesElement.remove();
  }
}

/**
 * Creates a style element containing CSS rules that are applied only during printing.
 */
function createPrintOnlyStyleElement() {
  const printStyles = document.createElement('style');
  printStyles.id = PRINT_ONLY_CONTENT_STYLES_ID;
  printStyles.textContent = PRINT_ONLY_CONTENT_CSS;
  return printStyles;
}

/**
 * Removes any existing print-only styles and appends new ones to the document head.
 */
function appendPrintOnlyStyles() {
  removePrintOnlyStyles();
  document.head.appendChild(createPrintOnlyStyleElement());
  return removePrintOnlyStyles;
}

/**
 * Wraps media elements with links to their source URLs for printing.
 */
function wrapMediaWithLink() {
  const createdShadowWrapper: HTMLElement[] = [];

  const prependLink = (
    el: Element,
    url: string | null,
    name: string | null,
    type: 'file' | 'audio' | 'video' | 'pdf',
  ) => {
    if (!url || !isSafeUrl(url)) {
      return;
    }
    const block = document.createElement('div');
    block.className = 'print-url-block-media';
    const link = document.createElement('a');
    link.className = 'print-url-link';

    const label = document.createElement('span');
    label.className = 'print-url-label';

    if (type === 'audio') {
      label.textContent = '🔊: ';
    } else if (type === 'video') {
      label.textContent = '📹: ';
    } else if (type === 'pdf') {
      label.textContent = '📑: ';
    } else {
      label.textContent = '🔗: ';
    }

    link.href = url;
    link.textContent = name || url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('data-print-link', 'true');
    block.appendChild(label);
    block.appendChild(link);

    const shadowWrapper = document.createElement('div');
    el.prepend(shadowWrapper);

    // Use a shadow root to avoid propagatic the changes to the collaboration provider
    const shadowRoot = shadowWrapper.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(block);
    createdShadowWrapper.push(shadowWrapper);
  };

  document
    .querySelectorAll(
      '[data-content-type="pdf"], [data-content-type="file"], [data-content-type="audio"], [data-content-type="video"]',
    )
    .forEach((el) => {
      const url = el?.getAttribute('data-url');
      const name = el?.getAttribute('data-name');
      const type = el?.getAttribute('data-content-type') as
        | 'file'
        | 'audio'
        | 'video'
        | 'pdf';
      if (type) {
        prependLink(el, url, name, type);
      }
    });

  return () => {
    // remove the shadow roots that were created
    createdShadowWrapper.forEach((link) => {
      link.remove();
    });
  };
}

export function printDocumentWithStyles() {
  if (typeof window === 'undefined') {
    return;
  }

  const cleanupPrintStyles = appendPrintOnlyStyles();

  // Small delay to ensure styles are applied
  setTimeout(() => {
    const cleanupLinks = wrapMediaWithLink();
    const cleanup = () => {
      cleanupLinks();
      cleanupPrintStyles();
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    requestAnimationFrame(() => window.print());

    // Also clean up after a delay as fallback
    setTimeout(cleanup, PRINT_CLEANUP_DELAY_MS);
  }, PRINT_APPLY_DELAY_MS);
}
