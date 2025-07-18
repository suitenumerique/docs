import { ExternalHyperlink, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';

export const inlineContentMappingInterlinkingLinkDocx: DocsExporterDocx['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    return new ExternalHyperlink({
      children: [
        new TextRun({
          text: `📄${inline.props.title}`,
          bold: true,
        }),
      ],
      link: window.location.origin + inline.props.url,
    });
  };
