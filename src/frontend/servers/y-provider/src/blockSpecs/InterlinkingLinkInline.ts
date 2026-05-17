import { createInlineContentSpec } from '@blocknote/core';

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

// Matches the frontend route (LinkSelected.tsx) so exported HTML/markdown
// links resolve identically client-side.
const interlinkingHref = (docId: string) =>
  `/docs/${encodeURIComponent(docId)}/`;

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
