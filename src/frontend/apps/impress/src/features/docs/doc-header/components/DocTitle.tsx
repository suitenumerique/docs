/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import {
  Tooltip,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useTrans,
  useUpdateDoc,
} from '@/features/docs/doc-management';
import { useBroadcastStore, useResponsiveStore } from '@/stores';

interface DocTitleProps {
  doc: Doc;
}

export const DocTitle = ({ doc }: DocTitleProps) => {
  if (!doc.abilities.partial_update) {
    return <DocTitleText title={doc.title} />;
  }

  return <DocTitleInput doc={doc} />;
};

interface DocTitleTextProps {
  title: string;
}

export const DocTitleText = ({ title }: DocTitleTextProps) => {
  const { isMobile } = useResponsiveStore();
  return (
    <Text
      as="h2"
      $margin={{ all: 'none', left: 'none' }}
      $size={isMobile ? 'h4' : 'h2'}
      $variation="1000"
    >
      {title}
    </Text>
  );
};

const DocTitleInput = ({ doc }: DocTitleProps) => {
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const [titleDisplay, setTitleDisplay] = useState(doc.title);
  const { toast } = useToastProvider();
  const { untitledDocument } = useTrans();
  const isUntitled = titleDisplay === untitledDocument;

  const { broadcast } = useBroadcastStore();

  const { mutate: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_DOC, KEY_LIST_DOC],
    onSuccess(data) {
      if (data.title !== untitledDocument) {
        toast(t('Document title updated successfully'), VariantType.SUCCESS);
      }

      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${data.id}`);
    },
  });

  const handleTitleSubmit = useCallback(
    (inputText: string) => {
      let sanitizedTitle = inputText.trim();
      sanitizedTitle = sanitizedTitle.replace(/(\r\n|\n|\r)/gm, '');

      // When blank we set to untitled
      if (!sanitizedTitle) {
        sanitizedTitle = untitledDocument;
        setTitleDisplay(sanitizedTitle);
      }

      // If mutation we update
      if (sanitizedTitle !== doc.title) {
        setTitleDisplay(sanitizedTitle);
        updateDoc({ id: doc.id, title: sanitizedTitle });
      }
    },
    [doc.id, doc.title, untitledDocument, updateDoc],
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
    <>
      <Tooltip content={t('Rename')} placement="top">
        <Box
          as="span"
          role="textbox"
          contentEditable
          defaultValue={isUntitled ? undefined : titleDisplay}
          onKeyDownCapture={handleKeyDown}
          suppressContentEditableWarning={true}
          aria-label="doc title input"
          onBlurCapture={(event) =>
            handleTitleSubmit(event.target.textContent || '')
          }
          $color={colorsTokens()['greyscale-1000']}
          $margin={{ left: '-2px', right: '10px' }}
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
          {isUntitled ? '' : titleDisplay}
        </Box>
      </Tooltip>
    </>
  );
};
