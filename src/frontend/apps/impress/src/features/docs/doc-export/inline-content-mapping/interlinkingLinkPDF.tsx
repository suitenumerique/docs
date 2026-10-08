import { Image, Link, Text } from '@react-pdf/renderer';

import { tokens } from '@/cunningham';
import { getEmojiAndTitle } from '@/docs/doc-management';

import DocSelectedIcon from '../assets/doc-selected.png';
import { DocsExporterPDF } from '../types';

// The same light underline as the interlink of the editor
const titleStyle = {
  textDecoration: 'underline',
  textDecorationColor: tokens.themes.default.globals.colors['gray-150'],
} as const;

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
        <Text style={titleStyle}>{titleWithoutEmoji}</Text>{' '}
      </Link>
    );
  };
