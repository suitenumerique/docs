import { ExternalHyperlink, TextRun } from 'docx';

import { getEmojiAndTitle } from '@/docs/doc-management';

import { DocsExporterDocx } from '../types';

export const inlineContentMappingInterlinkingLinkDocx: DocsExporterDocx['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    if (!inline.props.docId) {
      return new TextRun('');
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(inline.props.title);

    return new ExternalHyperlink({
      children: [
        new TextRun({
          text: `${emoji || '📄'}${titleWithoutEmoji}`,
          bold: true,
        }),
      ],
      link: window.location.origin + `/docs/${inline.props.docId}/`,
    });
  };
