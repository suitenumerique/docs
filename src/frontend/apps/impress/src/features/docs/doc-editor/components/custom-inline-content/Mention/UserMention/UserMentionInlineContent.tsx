import { StyleSchema } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { UserAvatar } from '@/features/auth';

export type UserMentionInlineContentType = {
  type: 'userMentionInline';
  propSchema: {
    userId: {
      default: '';
    };
    fullName: {
      default: '';
    };
  };
  content: 'none';
};

/**
 * The user is identified by its id, the same one the backend expects
 * as `mentioned_user_id`. The name is a snapshot of the user full name
 * at the time of the mention, so the mention can be displayed without
 * fetching the user.
 */
export const UserMentionInlineContent = createReactInlineContentSpec<
  UserMentionInlineContentType,
  StyleSchema
>(
  {
    type: 'userMentionInline',
    propSchema: {
      userId: {
        default: '',
      },
      fullName: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { userId, fullName } = props.inlineContent.props;

      if (!userId) {
        return null;
      }

      return <UserMention fullName={fullName} />;
    },
    /**
     * The external HTML is the source of the Markdown and of the plain
     * exports. The avatar is not an image there, it would be rendered as
     * markup, so only the name is kept.
     */
    toExternalHTML: (props) => {
      const { userId, fullName } = props.inlineContent.props;

      if (!userId) {
        return null;
      }

      return <span>@{fullName}</span>;
    },
  },
);

export const UserMention = ({ fullName }: { fullName: string }) => {
  return (
    <Box
      as="span"
      className="--docs--user-mention-inline-content"
      draggable="false"
      spellCheck="false"
      $display="inline-flex"
      $direction="row"
      $cursor="default"
      $css={css`
        border-radius: 4px;
        & svg {
          display: inline;
          position: relative;
          margin-right: 0.2rem;
          top: 4px;
        }
        transition: background-color var(--c--globals--transitions--duration)
          var(--c--globals--transitions--ease-out);
      `}
    >
      <UserAvatar fullName={fullName} width="18" height="18" />
      <Text
        $weight="500"
        spellCheck="false"
        $size="md"
        $margin={{ left: '2px' }}
      >
        {fullName}
      </Text>
    </Box>
  );
};
