import { Bookmark, ImageRun, TextRun } from 'docx';

import { DocsExporterDocx } from '../types';
import { dataUrlToBytes, getUserMentionAvatarPng } from '../userMentionAvatar';

const AVATAR_SIZE = 16;

let mentionCount = 0;

export const inlineContentMappingUserMentionDocx: DocsExporterDocx['mappings']['inlineContentMapping']['userMentionInline'] =
  (inline) => {
    if (!inline.props.userId) {
      return new TextRun('');
    }

    const avatar = getUserMentionAvatarPng(inline.props.fullName);

    if (!avatar) {
      return new TextRun({ text: `@${inline.props.fullName}`, bold: true });
    }

    // An inline content is exported as one paragraph child, a bookmark is the
    // invisible wrapper holding both the avatar and the name.
    return new Bookmark({
      id: `user-mention-${++mentionCount}`,
      children: [
        // The same non-breaking space as the one before the avatar of the editor
        new TextRun(' '),
        new ImageRun({
          type: 'png',
          data: dataUrlToBytes(avatar),
          transformation: { width: AVATAR_SIZE, height: AVATAR_SIZE },
        }),
        new TextRun({ text: ` ${inline.props.fullName}`, bold: true }),
      ],
    });
  };
