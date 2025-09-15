import { Tooltip } from '@openfun/cunningham-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  useDocStore,
  useDocTitleUpdate,
  useIsCollaborativeEditable,
  useTrans,
} from '@/docs/doc-management';
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
  const [titleDisplay, setTitleDisplay] = useState(doc.title);

  const { untitledDocument } = useTrans();

  const { updateDocTitle } = useDocTitleUpdate();

  const handleTitleSubmit = useCallback(
    (inputText: string) => {
      const sanitizedTitle = updateDocTitle(doc, inputText.trim());
      setTitleDisplay(sanitizedTitle);
    },
    [doc, updateDocTitle],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit(e.currentTarget.textContent || '');
    }
  };

  useEffect(() => {
    setTitleDisplay(doc.title);
  }, [doc]);

  return (
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
        $minHeight="40px"
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
  );
};
