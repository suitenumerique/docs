import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, Text } from '@/components';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { getEmojiAndTitle, useDoc } from '@/docs/doc-management/';

interface LinkSelectedProps {
  docId: string;
  title: string;
  isEditable: boolean;
  onUpdateTitle: (title: string) => void;
}
export const LinkSelected = ({
  docId,
  title,
  isEditable,
  onUpdateTitle,
}: LinkSelectedProps) => {
  const { data: doc } = useDoc({ id: docId });

  /**
   * Update the content title if the referenced doc title changes
   */
  useEffect(() => {
    if (isEditable && doc?.title && doc.title !== title) {
      onUpdateTitle(doc.title);
    }

    /**
     * ⚠️ When doing collaborative editing, doc?.title might be out of sync
     * causing an infinite loop of updates.
     * To prevent this, we only run this effect when doc?.title changes,
     * not when inlineContent.props.title changes.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.title, docId, isEditable]);

  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(title);
  const router = useRouter();
  const href = `/docs/${docId}/`;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // If ctrl or command is pressed, it opens a new tab. If shift is pressed, it opens a new window
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, '_blank');
      return;
    }
    void router.push(href);
  };

  // This triggers on middle-mouse click
  const handleAuxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 1) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank');
  };

  return (
    <BoxButton
      as="span"
      className="--docs--interlinking-link-inline-content"
      data-href={href}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      draggable="false"
      $height="28px"
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
        <SelectedPageIcon
          width={11.5}
          color="var(--c--contextuals--content--semantic--brand--tertiary)"
        />
      )}
      <Text
        $weight="500"
        spellCheck="false"
        $size="16px"
        $display="inline"
        $position="relative"
        $css={css`
          margin-left: 2px;
        `}
      >
        <Box
          className="--docs-interlinking-underline"
          as="span"
          $height="1px"
          $width="100%"
          $background="var(--c--contextuals--border--semantic--neutral--tertiary)"
          $position="absolute"
          $hasTransition
          $radius="2px"
          $css={css`
            left: 0;
            bottom: 0px;
          `}
        />
        <Box as="span" $zIndex="1" $position="relative">
          {titleWithoutEmoji}
        </Box>
      </Text>
    </BoxButton>
  );
};
