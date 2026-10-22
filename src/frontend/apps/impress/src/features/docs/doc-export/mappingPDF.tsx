import { diagramBlockMapping } from '@blocknote/diagram-block/typst-exporter';
import {
  inlineMathMapping,
  mathBlockMapping,
} from '@blocknote/math-block/typst-exporter';
import { strLit, typstDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterTypst } from './types';

export const getPdfDocsSchemaMappings = (
  interlinkTitles: Map<string, string>,
): DocsExporterTypst['mappings'] => ({
  ...typstDefaultSchemaMappings,
  blockMapping: {
    ...typstDefaultSchemaMappings.blockMapping,
    callout: (block, exporter) =>
      `#block(width: 100%, inset: 8pt)[#${strLit(block.props.emoji)} ${exporter.transformInlineContent(block.content).join('')}]`,
    // PDF blocks use the same link rendering as file blocks.
    pdf: (block) => {
      const { url, name, caption } = block.props;
      if (!url && !name) {
        return '';
      }
      const label = name || 'Open PDF file';
      const link = url
        ? `#link(${strLit(url)})[#${strLit(label)}]`
        : `#${strLit(label)}`;
      return caption
        ? `${link}#linebreak()#text(size: 9.6pt, fill: luma(110))[#${strLit(caption)}]`
        : link;
    },
    uploadLoader: (block) =>
      `#${strLit(block.props.type === 'loading' ? '⏳' : '⚠️')} #${strLit(block.props.information)}`,
    diagram: diagramBlockMapping,
    mathBlock: mathBlockMapping,
  },
  inlineContentMapping: {
    ...typstDefaultSchemaMappings.inlineContentMapping,
    interlinkingLinkInline: (inline) => {
      const title =
        inline.props.docId && interlinkTitles.get(inline.props.docId);
      if (!inline.props.docId || !title || inline.props.disabled) {
        return '';
      }

      const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);
      const href = `${window.location.origin}/docs/${inline.props.docId}/${inline.props.blockId ? `#${inline.props.blockId}` : ''}`;
      return `#link(${strLit(href)})[#${strLit(`${emoji || '📄'} ${titleWithoutEmoji}`)}]`;
    },
    math: inlineMathMapping,
  },
});
