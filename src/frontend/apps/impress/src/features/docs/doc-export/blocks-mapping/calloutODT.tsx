import React from 'react';

import { DocsExporterODT } from '../types';
import { odtRegisterParagraphStyleForBlock } from '../utils';

export const blockMappingCalloutODT: DocsExporterODT['mappings']['blockMapping']['callout'] =
  (block, exporter) => {
    // Map callout to paragraph with emoji prefix
    const emoji = block.props.emoji || '💡';

    // Transform inline content (text, bold, links, etc.)
    const inlineContent = exporter.transformInlineContent(block.content);

    // Resolve background and alignment → create a dedicated paragraph style
    const styleName = odtRegisterParagraphStyleForBlock(
      exporter,
      {
        backgroundColor: block.props.backgroundColor,
        textAlignment: block.props.textAlignment,
      },
      { paddingCm: 0.42 },
    );

    return React.createElement(
      'text:p',
      {
        'text:style-name': styleName,
      },
      `${emoji} `,
      ...inlineContent,
    );
  };
