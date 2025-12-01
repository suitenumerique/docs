import { Tooltip } from '@openfun/cunningham-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  DocIcon,
  getEmojiAndTitle,
  useDocStore,
  useDocTitleUpdate,
  useDocUtils,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
import SimpleFileIcon from '@/features/docs/doc-management/assets/simple-document.svg';
import { useResponsiveStore } from '@/stores';

interface DocTitleProps {
  doc: Doc;
}

export const DocTitle = ({ doc }: DocTitleProps) => {
  const { isEditable, isLoading } = useIsCollaborativeEditable(doc);
  const readOnly = !doc.abilities.partial_update || !isEditable || isLoading;

  if (readOnly) {
    return <DocTitleText />;
  }

  return <DocTitleInput doc={doc} />;
};

export const DocTitleText = () => {
  const { isMobile } = useResponsiveStore();
  const { currentDoc } = useDocStore();
  const { untitledDocument } = useTrans();

  return (
    <Text
      as="h2"
      $margin={{ all: 'none', left: 'none' }}
      $size={isMobile ? 'h4' : 'h2'}
    >
      {currentDoc?.title || untitledDocument}
    </Text>
  );
};

const DocTitleEmojiPicker = ({ doc }: DocTitleProps) => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { emoji } = getEmojiAndTitle(doc.title ?? '');

  if (!emoji) {
    return null;
  }

  return (
    <Tooltip
      content={t('Edit document emoji')}
      aria-hidden={true}
      placement="top"
    >
      <Box
        $css={css`
          padding: 4px;
          padding-top: 3px;
          cursor: pointer;
          &:hover {
            background-color: ${colorsTokens['gray-100']};
            border-radius: var(--c--globals--spacings--st);
          }
          transition: background-color var(--c--globals--transitions--duration)
            var(--c--globals--transitions--ease-out);
        `}
      >
        <DocIcon
          buttonProps={{
            $width: '32px',
            $height: '32px',
            $justify: 'space-between',
            $align: 'center',
          }}
          withEmojiPicker={doc.abilities.partial_update}
          docId={doc.id}
          title={doc.title}
          emoji={emoji}
          $size="23px"
          defaultIcon={
            <SimpleFileIcon
              width="25px"
              height="25px"
              aria-hidden="true"
              aria-label={t('Simple document icon')}
              color={colorsTokens['brand-500']}
            />
          }
        />
      </Box>
    </Tooltip>
  );
};

const DocTitleInput = ({ doc }: DocTitleProps) => {
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { isTopRoot } = useDocUtils(doc);
  const { untitledDocument } = useTrans();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title ?? '');
  const [titleDisplay, setTitleDisplay] = useState(
    isTopRoot ? doc.title : titleWithoutEmoji,
  );

  const { updateDocTitle } = useDocTitleUpdate();

  const handleTitleSubmit = useCallback(
    (inputText: string) => {
      if (isTopRoot) {
        const sanitizedTitle = updateDocTitle(doc, inputText);
        setTitleDisplay(sanitizedTitle);
        return sanitizedTitle;
      } else {
        const { emoji: pastedEmoji } = getEmojiAndTitle(inputText);
        const textPreservingPastedEmoji = pastedEmoji
          ? `\u200B${inputText}`
          : inputText;
        const finalTitle = emoji
          ? `${emoji} ${textPreservingPastedEmoji}`
          : textPreservingPastedEmoji;

        const sanitizedTitle = updateDocTitle(doc, finalTitle);
        const { titleWithoutEmoji: sanitizedTitleWithoutEmoji } =
          getEmojiAndTitle(sanitizedTitle);

        setTitleDisplay(sanitizedTitleWithoutEmoji);
      }
    },
    [updateDocTitle, doc, emoji, isTopRoot],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit(e.currentTarget.textContent || '');
    }
  };

  useEffect(() => {
    setTitleDisplay(isTopRoot ? doc.title : titleWithoutEmoji);
  }, [doc.title, isTopRoot, titleWithoutEmoji]);

  return (
    <Box
      className="--docs--doc-title"
      $direction="row"
      $align="center"
      $gap="4px"
      $minHeight="40px"
    >
      {!isTopRoot && <DocTitleEmojiPicker doc={doc} />}

      <Tooltip content={t('Rename')} aria-hidden={true} placement="top">
        <Box
          as="span"
          role="textbox"
          className="--docs--doc-title-input"
          contentEditable
          defaultValue={titleDisplay || undefined}
          onKeyDownCapture={handleKeyDown}
          suppressContentEditableWarning={true}
          aria-label={`${t('Document title')}`}
          aria-multiline={false}
          onBlurCapture={(event) =>
            handleTitleSubmit(event.target.textContent || '')
          }
          $padding={{ right: 'big' }}
          $css={css`
            &[contenteditable='true']:empty:not(:focus):before {
              content: '${untitledDocument}';
              color: var(
                --c--contextuals--content--semantic--neutral--tertiary
              );
              pointer-events: none;
              font-style: italic;
            }
            font-size: ${isDesktop
              ? css`var(--c--globals--font--sizes--h2)`
              : css`var(--c--globals--font--sizes--sm)`};
            font-weight: 700;
            outline: none;
          `}
        >
          {titleDisplay}
        </Box>
      </Tooltip>
    </Box>
  );
};
