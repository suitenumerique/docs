import React from 'react';

import { DocsExporterODT } from '../types';

export const inlineContentMappingInterlinkingLinkODT: DocsExporterODT['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    const url = window.location.origin + inline.props.url;
    const title = inline.props.title;

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
      `📄${title}`,
    );
  };
