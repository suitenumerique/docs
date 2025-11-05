/* eslint-disable react-hooks/rules-of-hooks */
import { createReactInlineContentSpec } from '@blocknote/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { css } from 'styled-components';

import { BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { getEmojiAndTitle, useDoc } from '@/docs/doc-management';

export const InterlinkingLinkInlineContent = createReactInlineContentSpec(
  {
    type: 'interlinkingLinkInline',
    propSchema: {
      url: {
        default: '',
      },
      docId: {
        default: '',
      },
      title: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent, updateInlineContent }) => {
      const { data: doc } = useDoc({ id: inlineContent.props.docId });

      /**
       * Update the content title if the referenced doc title changes
       */
      useEffect(() => {
        if (doc?.title && doc.title !== inlineContent.props.title) {
          updateInlineContent({
            type: 'interlinkingLinkInline',
            props: {
              ...inlineContent.props,
              title: doc.title,
            },
          });
        }

        /**
         * ⚠️ When doing collaborative editing, doc?.title might be out of sync
         * causing an infinite loop of updates.
         * To prevent this, we only run this effect when doc?.title changes,
         * not when inlineContent.props.title changes.
         */
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [doc?.title]);

      return <LinkSelected {...inlineContent.props} />;
    },
  },
);

interface LinkSelectedProps {
  url: string;
  title: string;
}
const LinkSelected = ({ url, title }: LinkSelectedProps) => {
  const { colorsTokens } = useCunninghamTheme();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    void router.push(url);
  };

  return (
    <BoxButton
      onClick={handleClick}
      draggable="false"
      $css={css`
        display: contents;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        & svg {
          position: relative;
          top: 2px;
          margin-right: 0.2rem;
        }
        &:hover {
          background-color: ${colorsTokens['greyscale-100']};
        }
        transition: background-color 0.2s ease-in-out;
      `}
    >
      {emoji ? (
        <Text $size="16px">{emoji}</Text>
      ) : (
        <SelectedPageIcon width={11.5} color={colorsTokens['primary-400']} />
      )}
      <Text
        $weight="500"
        spellCheck="false"
        $size="16px"
        $display="inline"
        $css={css`
          margin-left: 2px;
        `}
      >
        {titleWithoutEmoji}
      </Text>
    </BoxButton>
  );
};
