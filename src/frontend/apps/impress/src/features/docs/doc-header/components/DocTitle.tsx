import { Tooltip } from '@openfun/cunningham-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  getEmojiAndTitle,
  useDocStore,
  useTrans,
} from '@/docs/doc-management';
import SimpleFileIcon from '@/features/docs/doc-management/assets/simple-document.svg';
import { useDocTitleUpdate } from '@/features/docs/doc-management/hooks/useDocTitleUpdate';
import { useResponsiveStore } from '@/stores';

import { DocIcon } from '../../doc-management/components/DocIcon';

interface DocTitleProps {
  doc: Doc;
}

export const DocTitle = ({ doc }: DocTitleProps) => {
  if (!doc.abilities.partial_update) {
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
      $variation="1000"
    >
      {currentDoc?.title || untitledDocument}
    </Text>
  );
};

const DocTitleInput = ({ doc }: DocTitleProps) => {
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(doc.title ?? '');
  const { spacingsTokens } = useCunninghamTheme();

  const { untitledDocument } = useTrans();
  const [titleDisplay, setTitleDisplay] = useState(titleWithoutEmoji);

  const { updateDocTitle } = useDocTitleUpdate();

  const handleTitleSubmit = useCallback(
    (inputText: string) => {
      const sanitizedTitle = updateDocTitle(
        doc,
        emoji ? `${emoji} ${inputText.trim()}` : inputText.trim(),
      );
      const { titleWithoutEmoji: sanitizedTitleWithoutEmoji } =
        getEmojiAndTitle(sanitizedTitle);

      setTitleDisplay(sanitizedTitleWithoutEmoji);
    },
    [doc, updateDocTitle, emoji],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit(e.currentTarget.textContent || '');
    }
  };

  useEffect(() => {
    setTitleDisplay(titleWithoutEmoji);
  }, [doc, titleWithoutEmoji]);

  return (
    <Box
      $direction="row"
      $align="flex-end"
      $gap={spacingsTokens['s']}
      $minHeight="40px"
    >
      <Tooltip content={t('Document emoji')} aria-hidden={true} placement="top">
        <Box
          $css={css`
            height: 58px;
            cursor: pointer;
          `}
        >
          <DocIcon
            emojiPicker
            docId={doc.id}
            title={doc.title}
            emoji={emoji}
            $size="50px"
            defaultIcon={
              <SimpleFileIcon
                width="50px"
                height="50px"
                aria-hidden="true"
                aria-label={t('Simple document icon')}
                color={colorsTokens['primary-500']}
              />
            }
          />
        </Box>
      </Tooltip>

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
          $color={colorsTokens['greyscale-1000']}
          $padding={{ right: 'big' }}
          $css={css`
            &[contenteditable='true']:empty:not(:focus):before {
              content: '${untitledDocument}';
              color: grey;
              pointer-events: none;
              font-style: italic;
            }
            font-size: ${isDesktop
              ? css`var(--c--theme--font--sizes--h2)`
              : css`var(--c--theme--font--sizes--sm)`};
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
