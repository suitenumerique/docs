import { strLit } from '@blocknote/xl-pdf-exporter';

import { DocsBlockMappingPDF } from '../types';

/**
 * Renders a callout as its emoji next to its content, in a grid so that
 * wrapped lines stay aligned with the text and not under the emoji.
 * The background color is applied by the exporter from the block props.
 */
export const blockMappingCalloutPDF: DocsBlockMappingPDF<'callout'> = (
  block,
  exporter,
) => {
  const content = exporter.transformInlineContent(block.content).join('');

  return `#grid(columns: (auto, 1fr), column-gutter: 6pt, [#${strLit(
    block.props.emoji,
  )}], [${content}])`;
};
