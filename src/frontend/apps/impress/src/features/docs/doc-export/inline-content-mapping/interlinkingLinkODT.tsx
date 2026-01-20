import React from 'react';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterODT } from '../types';

export const inlineContentMappingInterlinkingLinkODT: DocsExporterODT['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    if (!inline.props.docId) {
      return null;
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(inline.props.title);
    const url = window.location.origin + `/docs/${inline.props.docId}/`;

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
