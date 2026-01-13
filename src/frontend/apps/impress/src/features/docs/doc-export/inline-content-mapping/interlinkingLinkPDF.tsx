import { Image, Link, Text } from '@react-pdf/renderer';

import { getEmojiAndTitle } from '@/docs/doc-management';

import DocSelectedIcon from '../assets/doc-selected.png';
import { DocsExporterPDF } from '../types';

export const inlineContentMappingInterlinkingLinkPDF: DocsExporterPDF['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    if (!inline.props.docId) {
      return <></>;
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(inline.props.title);

    return (
      <Link
        src={window.location.origin + `/docs/${inline.props.docId}/`}
        style={{
          textDecoration: 'none',
          color: 'black',
        }}
      >
        {' '}
        {emoji || <Image src={DocSelectedIcon.src} />}{' '}
        <Text>{titleWithoutEmoji}</Text>{' '}
      </Link>
    );
  };
