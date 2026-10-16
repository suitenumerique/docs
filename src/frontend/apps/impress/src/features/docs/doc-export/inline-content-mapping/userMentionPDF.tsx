import { Image, Text } from '@react-pdf/renderer';

import { DocsExporterPDF } from '../types';
import { getUserMentionAvatarPng } from '../userMentionAvatar';

const AVATAR_SIZE = 12;

export const inlineContentMappingUserMentionPDF: DocsExporterPDF['mappings']['inlineContentMapping']['userMentionInline'] =
  (inline) => {
    if (!inline.props.userId) {
      return <></>;
    }

    const avatar = getUserMentionAvatarPng(inline.props.fullName);

    return (
      <Text style={{ fontWeight: 'bold' }}>
        {' '}
        {avatar && (
          <>
            <Image
              src={avatar}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            />{' '}
          </>
        )}
        {inline.props.fullName}
      </Text>
    );
  };
