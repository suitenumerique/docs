import { TypstExporter, strLit } from '@blocknote/xl-pdf-exporter';

import { DocsExporterPDF } from '../types';
import { dataUrlToBytes, getUserMentionAvatarPng } from '../userMentionAvatar';

const AVATAR_SIZE = '9pt';

/**
 * Renders a user mention as the avatar of the user followed by their name in
 * bold. The avatar only repeats the initials of the name, so it is marked as
 * an artifact: PDF/UA requires an alternative text on every other image, and
 * screen readers only read the name.
 */
export const inlineContentMappingUserMentionPDF: DocsExporterPDF['mappings']['inlineContentMapping']['userMentionInline'] =
  (inline, exporter) => {
    const { userId, fullName } = inline.props;
    if (!userId) {
      return '';
    }

    const name = `#strong(${strLit(fullName)})`;
    const avatar = getUserMentionAvatarPng(fullName);
    if (!avatar) {
      return name;
    }

    const path = (
      exporter as unknown as TypstExporter<never, never, never>
    ).registerImageBytes(`user-mention|${fullName}`, dataUrlToBytes(avatar));

    return `#pdf.artifact(box(baseline: 15%, image(${strLit(
      path,
    )}, width: ${AVATAR_SIZE})))#h(0.25em)${name}`;
  };
