import { ExternalHyperlink, TextRun } from 'docx';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterDocx } from '../types';

export const createInlineContentMappingInterlinkingLinkDocx =
  (
    titleMap: Map<string, string>,
  ): DocsExporterDocx['mappings']['inlineContentMapping']['interlinkingLinkInline'] =>
  (inline) => {
    // A label given by the user is not a title: its emoji stays in its text
    const label = inline.props.label;
    const title =
      inline.props.docId && (label || titleMap.get(inline.props.docId));

    if (!inline.props.docId || !title || inline.props.disabled) {
      return new TextRun('');
    }

    const { emoji, titleWithoutEmoji } = label
      ? { emoji: undefined, titleWithoutEmoji: label }
      : getEmojiAndTitle(title);

    return new ExternalHyperlink({
      children: [
        new TextRun({
          text: `${emoji || '📄'}${titleWithoutEmoji}`,
          bold: true,
        }),
      ],
      link:
        window.location.origin +
        `/docs/${inline.props.docId}/${inline.props.blockId ? `#${inline.props.blockId}` : ''}`,
    });
  };
