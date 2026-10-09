import { ExternalHyperlink, TextRun } from 'docx';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterDocx } from '../types';

export const createInlineContentMappingInterlinkingLinkDocx =
  (
    titleMap: Map<string, string>,
  ): DocsExporterDocx['mappings']['inlineContentMapping']['interlinkingLinkInline'] =>
  (inline) => {
    const title = inline.props.docId && titleMap.get(inline.props.docId);

    if (!inline.props.docId || !title || inline.props.disabled) {
      return new TextRun('');
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);

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
