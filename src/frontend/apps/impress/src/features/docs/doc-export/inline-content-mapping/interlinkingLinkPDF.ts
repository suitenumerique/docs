import { strLit } from '@blocknote/xl-pdf-exporter';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterPDF } from '../types';

export const createInlineContentMappingInterlinkingLinkPDF =
  (
    titleMap: Map<string, string>,
  ): DocsExporterPDF['mappings']['inlineContentMapping']['interlinkingLinkInline'] =>
  (inline) => {
    const title = inline.props.docId && titleMap.get(inline.props.docId);

    if (!inline.props.docId || !title || inline.props.disabled) {
      return '';
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);
    const url =
      window.location.origin +
      `/docs/${inline.props.docId}/${inline.props.blockId ? `#${inline.props.blockId}` : ''}`;

    if (emoji) {
      return `#link(${strLit(url)})[#${strLit(`${emoji} ${titleWithoutEmoji}`)}]`;
    }

    // Unlike the emoji of the document, part of its title, the default icon is
    // decorative: it is marked as an artifact, so that it is not read. It
    // stays out of the link, PDF/UA forbidding a link to contain an artifact.
    return `#pdf.artifact[📄 ]#link(${strLit(url)})[#${strLit(titleWithoutEmoji)}]`;
  };
