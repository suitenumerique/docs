import { Image, Link, Text } from '@react-pdf/renderer';

import { getEmojiAndTitle } from '@/docs/doc-management';

import DocSelectedIcon from '../assets/doc-selected.png';
import { DocsExporterPDF } from '../types';

export const createInlineContentMappingInterlinkingLinkPDF =
  (
    titleMap: Map<string, string>,
  ): DocsExporterPDF['mappings']['inlineContentMapping']['interlinkingLinkInline'] =>
  (inline) => {
    const title = inline.props.docId && titleMap.get(inline.props.docId);

    if (!inline.props.docId || !title || inline.props.disabled) {
      return <></>;
    }

    const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);

    return (
      <Link
        src={
          window.location.origin +
          `/docs/${inline.props.docId}/${inline.props.blockId ? `#${inline.props.blockId}` : ''}`
        }
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
