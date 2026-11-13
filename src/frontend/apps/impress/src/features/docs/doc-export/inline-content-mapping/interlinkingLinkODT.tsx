import React from 'react';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterODT } from '../types';

export const createInlineContentMappingInterlinkingLinkODT =
  (
    titleMap: Map<string, string>,
  ): DocsExporterODT['mappings']['inlineContentMapping']['interlinkingLinkInline'] =>
  (inline) => {
    // A label given by the user is not a title: its emoji stays in its text
    const label = inline.props.label;
    const title =
      inline.props.docId && (label || titleMap.get(inline.props.docId));

    if (!inline.props.docId || !title || inline.props.disabled) {
      return null;
    }

    const { emoji, titleWithoutEmoji } = label
      ? { emoji: undefined, titleWithoutEmoji: label }
      : getEmojiAndTitle(title);
    const url =
      window.location.origin +
      `/docs/${inline.props.docId}/${inline.props.blockId ? `#${inline.props.blockId}` : ''}`;

    // Create ODT hyperlink using React.createElement to avoid TypeScript JSX namespace issues
    // Uses the same structure as BlockNote's default link mapping
    return React.createElement(
      'text:a',
      {
        xlinkType: 'simple',
        'text:style-name': 'Internet_20_link',
        'office:target-frame-name': '_top',
        xlinkShow: 'replace',
        xlinkHref: url,
      },
      `${emoji || '📄'}${titleWithoutEmoji}`,
    );
  };
