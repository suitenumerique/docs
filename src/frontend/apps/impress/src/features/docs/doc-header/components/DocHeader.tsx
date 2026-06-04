import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import RemoveEmojiSVG from '@/assets/icons/ui-kit/face-remove.svg';
import AddEmojiSVG from '@/assets/icons/ui-kit/face.svg';
import { Box, HorizontalSeparator } from '@/components';
import {
  Doc,
  getEmojiAndTitle,
  useDocTitleUpdate,
  useDocUtils,
  useIsCollaborativeEditable,
} from '@/docs/doc-management';

import { AlertNetwork } from './AlertNetwork';
import { AlertRestore } from './AlertRestore';
import { DocHeaderInfo } from './DocHeaderInfo';
import { DocTitle } from './DocTitle';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { t } = useTranslation();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const isDeletedDoc = !!doc.deleted_at;
  // Emoji Management
  const { emoji } = getEmojiAndTitle(doc.title ?? '');
  const { updateDocEmoji } = useDocTitleUpdate();
  const { isTopRoot } = useDocUtils(doc);
  const displayEmojiButton = doc.abilities.partial_update && !isTopRoot;

  return (
    <>
      <Box
        $width="100%"
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
        $minHeight="125px"
        $css={css`
          .--docs--doc-header-emoji-button {
            opacity: 0;

            &:focus {
              opacity: 1;
            }
          }
          &:hover {
            .--docs--doc-header-emoji-button {
              opacity: 1;
            }
          }
        `}
      >
        <Box
          $gap="base"
          $padding={{
            bottom: isDeletedDoc || !isEditable ? 'base' : undefined,
          }}
        >
          {isDeletedDoc && <AlertRestore doc={doc} />}
          {!isEditable && <AlertNetwork />}
        </Box>
        <Box $gap="sm">
          <Box>
            {displayEmojiButton && (
              <Button
                className="--docs--doc-header-emoji-button"
                size="nano"
                onClick={() => {
                  const today = new Date();
                  const isAprilFools =
                    today.getMonth() === 3 && today.getDate() === 1;
                  emoji
                    ? updateDocEmoji(doc.id, doc.title ?? '', '')
                    : updateDocEmoji(
                        doc.id,
                        doc.title ?? '',
                        isAprilFools ? '🐟' : '📄',
                      );
                }}
                aria-label={emoji ? t('Remove icon') : t('Add icon')}
                color="neutral"
                variant="tertiary"
                icon={
                  emoji ? (
                    <RemoveEmojiSVG width={16} height={16} aria-hidden="true" />
                  ) : (
                    <AddEmojiSVG width={16} height={16} aria-hidden="true" />
                  )
                }
                style={{ width: 'fit-content' }}
              >
                {emoji ? t('Remove icon') : t('Add icon')}
              </Button>
            )}
          </Box>
          <DocTitle doc={doc} />
          <DocHeaderInfo doc={doc} />
        </Box>
        <HorizontalSeparator $margin={{ top: '24px' }} />
      </Box>
    </>
  );
};
