import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export const CLASS_DOC_TITLE = '--docs--doc-title';

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
    <Box className={CLASS_DOC_TITLE} $direction="row" $align="center">
      <Text as="h2" $margin="none" $size={isMobile ? 'h4' : 'h2'}>
        {currentDoc?.title || untitledDocument}
      </Text>
    </Box>
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
    <Box
      className={CLASS_DOC_TITLE}
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
  );
};

const DocTitleInput = ({ doc }: DocTitleProps) => {
  const { isSmallMobile } = useResponsiveStore();
  const { t } = useTranslation();
  const { isTopRoot } = useDocUtils(doc);
  const { untitledDocument } = useTrans();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title ?? '');
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  const insertPlainText = (plainText: string, target: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!target.contains(range.commonAncestorContainer)) {
      target.focus();
      range.selectNodeContents(target);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    range.deleteContents();
    range.insertNode(document.createTextNode(plainText));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLSpanElement>) => {
    event.preventDefault();
    insertPlainText(
      event.clipboardData.getData('text/plain'),
      event.currentTarget,
    );
  };

  const handleDrop = (event: React.DragEvent<HTMLSpanElement>) => {
    event.preventDefault();
    insertPlainText(
      event.dataTransfer.getData('text/plain'),
      event.currentTarget,
    );
  };

  useEffect(() => {
    setTitleDisplay(isTopRoot ? doc.title : titleWithoutEmoji);
  }, [doc.title, isTopRoot, titleWithoutEmoji]);

  return (
    <Box
      className={CLASS_DOC_TITLE}
      $direction="row"
      $align="center"
      $gap="4px"
      $minHeight="40px"
    >
      {!isTopRoot && <DocTitleEmojiPicker doc={doc} />}
      {/**
       * This wrapper div is necessary to handle focus.
       * Benefit:
       * - The tooltip will show exactly in the middle of the title input text
       * - When the user is click on the right side of the doc title, the title get the focus
       *   and the cursor, which is the expected behavior when editing a title.
       */}
      <Box
        ref={wrapperRef}
        $flex="1"
        $css={css`
          cursor: text;
        `}
        onClick={() => {
          const el = wrapperRef.current?.querySelector<HTMLElement>(
            '.--docs--doc-title-input[contenteditable="true"]',
          );
          if (el && document.activeElement !== el) {
            el.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }}
        $width="100%"
      >
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
          onPasteCapture={handlePaste}
          onDropCapture={handleDrop}
          $css={css`
            &[contenteditable='true']:empty:not(:focus):before {
              content: '${untitledDocument}';
              color: var(
                --c--contextuals--content--semantic--neutral--tertiary
              );
              pointer-events: none;
              font-style: italic;
            }
            font-size: ${isSmallMobile
              ? 'var(--c--globals--font--sizes--h4)'
              : 'var(--c--globals--font--sizes--h2)'};
            font-weight: 700;
            outline: none;
          `}
          $width="fit-content"
        >
          {titleDisplay}
        </Box>
      </Box>
    </Box>
  );
};
