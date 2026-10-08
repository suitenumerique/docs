import React from 'react';

import { DocsExporterODT } from '../types';
import { getUserMentionAvatarPng } from '../userMentionAvatar';

const AVATAR_SIZE_CM = 0.45;

let mentionCount = 0;

export const inlineContentMappingUserMentionODT: DocsExporterODT['mappings']['inlineContentMapping']['userMentionInline'] =
  (inline) => {
    if (!inline.props.userId) {
      return null;
    }

    const avatar = getUserMentionAvatarPng(inline.props.fullName);

    if (!avatar) {
      return `@${inline.props.fullName}`;
    }

    // Embedded the same way as the images of the doc, as inline binary data
    return React.createElement(
      React.Fragment,
      null,
      // The same non-breaking space as the one before the avatar of the editor,
      // a plain space could be collapsed with the previous one.
      ' ',
      React.createElement(
        'draw:frame',
        {
          'draw:name': `UserMention${++mentionCount}`,
          'text:anchor-type': 'as-char',
          'svg:width': `${AVATAR_SIZE_CM}cm`,
          'svg:height': `${AVATAR_SIZE_CM}cm`,
        },
        React.createElement(
          'draw:image',
          {
            xlinkType: 'simple',
            xlinkShow: 'embed',
            xlinkActuate: 'onLoad',
          },
          React.createElement('office:binary-data', {}, avatar.split(',')[1]),
        ),
      ),
      ` ${inline.props.fullName}`,
    );
  };
