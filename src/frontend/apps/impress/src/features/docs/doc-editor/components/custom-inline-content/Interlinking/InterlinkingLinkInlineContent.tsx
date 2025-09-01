/* eslint-disable react-hooks/rules-of-hooks */
import { createReactInlineContentSpec } from '@blocknote/react';
import { useEffect } from 'react';
import { css } from 'styled-components';

import { StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { useDoc } from '@/docs/doc-management';

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
      }, [inlineContent.props, doc?.title, updateInlineContent]);

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

  return (
    <StyledLink
      href={url}
      draggable="false"
      $css={css`
        display: inline;
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
      <SelectedPageIcon width={11.5} />
      <Text $weight="500" spellCheck="false" $size="16px" $display="inline">
        {title}
      </Text>
    </StyledLink>
  );
};
