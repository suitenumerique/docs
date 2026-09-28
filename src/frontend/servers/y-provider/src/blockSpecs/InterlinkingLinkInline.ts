import { createInlineContentSpec } from '@blocknote/core';

import { COLLABORATION_SERVER_ORIGIN } from '@/env';

const interlinkingPropSchema = {
  docId: { default: '' as string },
  disabled: {
    default: false as boolean,
    values: [true, false] as const,
  },
  trigger: {
    default: '/' as const,
    values: ['/', '@'] as const,
  },
  title: { default: '' as string },
} as const;

const interlinkingConfig = {
  type: 'interlinkingLinkInline' as const,
  propSchema: interlinkingPropSchema,
  content: 'none' as const,
};

// The instance origin the docs are served from. COLLABORATION_SERVER_ORIGIN may
// hold a comma-separated list of allowed origins (see middlewares.ts); the first
// one is the canonical instance URL.
const instanceOrigin = COLLABORATION_SERVER_ORIGIN.split(',')[0].replace(
  /\/+$/,
  '',
);

// Matches the frontend route (LinkSelected.tsx), but exported as an absolute URL
// so the links resolve outside of the app (Docs-as-CMS, emails, etc.) rather than
// against whatever host the exported HTML/markdown happens to be served from.
const interlinkingHref = (docId: string) =>
  `${instanceOrigin}/docs/${encodeURIComponent(docId)}/`;

export const InterlinkingLinkInline = createInlineContentSpec(
  interlinkingConfig,
  {
    render: (inlineContent) => {
      const { disabled, docId, title } = inlineContent.props;
      if (disabled || !docId) {
        return { dom: document.createElement('span') };
      }

      const dom = document.createElement('a');
      dom.setAttribute('data-inline-content-type', 'interlinkingLinkInline');
      dom.setAttribute('href', interlinkingHref(docId));
      dom.setAttribute('data-doc-id', docId);
      dom.textContent = title || docId;
      return { dom };
    },
    toExternalHTML: (inlineContent) => {
      const { disabled, docId, title } = inlineContent.props;
      // Matches the frontend (InterlinkingLinkInlineContent.tsx): a disabled
      // or unresolved link must not render any visible content.
      if (disabled || !docId) {
        return { dom: document.createElement('span') };
      }

      const dom = document.createElement('a');
      dom.setAttribute('href', interlinkingHref(docId));
      dom.setAttribute('data-doc-id', docId);
      if (title) {
        dom.setAttribute('title', title);
      }
      dom.textContent = title || docId;
      return { dom };
    },
  },
);
