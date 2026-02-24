import {
  PartialCustomInlineContentFromConfig,
  StyleSchema,
} from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { css } from 'styled-components';
import { validate as uuidValidate } from 'uuid';

import { BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { getEmojiAndTitle, useDoc } from '@/docs/doc-management/';

export const InterlinkingLinkInlineContent = createReactInlineContentSpec(
  {
    type: 'interlinkingLinkInline',
    propSchema: {
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
    render: ({ editor, inlineContent, updateInlineContent }) => {
      if (!inlineContent.props.docId) {
        return null;
      }

      /**
       * Should not happen
       */
      if (!uuidValidate(inlineContent.props.docId)) {
        Sentry.captureException(
          new Error(`Invalid docId: ${inlineContent.props.docId}`),
          {
            extra: { info: 'InterlinkingLinkInlineContent' },
          },
        );

        updateInlineContent({
          type: 'interlinkingLinkInline',
          props: {
            docId: '',
            title: '',
          },
        });

        return null;
      }

      return (
        <LinkSelected
          docId={inlineContent.props.docId}
          title={inlineContent.props.title}
          isEditable={editor.isEditable}
          updateInlineContent={updateInlineContent}
        />
      );
    },
  },
);

interface LinkSelectedProps {
  docId: string;
  title: string;
  isEditable: boolean;
  updateInlineContent: (
    update: PartialCustomInlineContentFromConfig<
      {
        readonly type: 'interlinkingLinkInline';
        readonly propSchema: {
          readonly docId: {
            readonly default: '';
          };
          readonly title: {
            readonly default: '';
          };
        };
        readonly content: 'none';
      },
      StyleSchema
    >,
  ) => void;
}
export const LinkSelected = ({
  docId,
  title,
  isEditable,
  updateInlineContent,
}: LinkSelectedProps) => {
  const { data: doc } = useDoc({ id: docId, withoutContent: true });

  /**
   * Update the content title if the referenced doc title changes
   */
  useEffect(() => {
    if (isEditable && doc?.title && doc.title !== title) {
      updateInlineContent({
        type: 'interlinkingLinkInline',
        props: {
          docId,
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
  }, [doc?.title, docId, isEditable]);

  const { colorsTokens } = useCunninghamTheme();

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    void router.push(`/docs/${docId}/`);
  };

  return (
    <BoxButton
      as="span"
      className="--docs--interlinking-link-inline-content"
      onClick={handleClick}
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
          background-color: var(
            --c--contextuals--background--semantic--contextual--primary
          );
        }
        transition: background-color var(--c--globals--transitions--duration)
          var(--c--globals--transitions--ease-out);

        .--docs--doc-deleted & {
          pointer-events: none;
        }
      `}
    >
      {emoji ? (
        <Text $size="16px">{emoji}</Text>
      ) : (
        <SelectedPageIcon width={11.5} color={colorsTokens['brand-400']} />
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
