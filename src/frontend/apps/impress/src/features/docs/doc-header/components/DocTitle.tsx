import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { Tooltip } from '@openfun/cunningham-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useDocStore,
  useTrans,
  useUpdateDoc,
} from '@/docs/doc-management';
import { useBroadcastStore, useResponsiveStore } from '@/stores';

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
  const [titleDisplay, setTitleDisplay] = useState(doc.title);
  const treeContext = useTreeContext<Doc>();

  const { untitledDocument } = useTrans();

  const { broadcast } = useBroadcastStore();

  const { mutate: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_DOC, KEY_LIST_DOC],
    onSuccess(updatedDoc) {
      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${updatedDoc.id}`);

      if (!treeContext) {
        return;
      }

      if (treeContext.root?.id === updatedDoc.id) {
        treeContext?.setRoot(updatedDoc);
      } else {
        treeContext?.treeData.updateNode(updatedDoc.id, updatedDoc);
      }
    },
  });

  const handleTitleSubmit = useCallback(
    (inputText: string) => {
      let sanitizedTitle = inputText.trim();
      sanitizedTitle = sanitizedTitle.replace(/(\r\n|\n|\r)/gm, '');

      // When blank we set to untitled
      if (!sanitizedTitle) {
        setTitleDisplay('');
      }

      // If mutation we update
      if (sanitizedTitle !== doc.title) {
        setTitleDisplay(sanitizedTitle);
        updateDoc({ id: doc.id, title: sanitizedTitle });
      }
    },
    [doc.id, doc.title, updateDoc],
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
