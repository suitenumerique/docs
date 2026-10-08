import { Button } from '@gouvfr-lasuite/ui-components';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import RemoveEmojiSVG from '@/assets/icons/ui-kit/face-remove.svg';
import AddEmojiSVG from '@/assets/icons/ui-kit/face.svg';
import { Box, EmojiPicker, HorizontalSeparator } from '@/components';
import { getEmojidata } from '@/components/Emoji/initEmojiCallout';
import {
  Doc,
  getEmojiAndTitle,
  useDocTitleUpdate,
  useDocUtils,
} from '@/docs/doc-management';
import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { useFocusStore } from '@/stores';

import { AlertOffline } from './AlertOffline';
import { AlertRestore } from './AlertRestore';
import { DocHeaderInfo } from './DocHeaderInfo';
import { DocTitle } from './DocTitle';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { t } = useTranslation();
  const isDeletedDoc = !!doc.deleted_at;
  const isOffline = useIsOffline((state) => state.isOffline);

  const { emoji } = getEmojiAndTitle(doc.title ?? '');
  const { updateDocEmoji } = useDocTitleUpdate();

  const { isTopRoot } = useDocUtils(doc);
  const displayEmojiButton = doc.abilities.partial_update && !isTopRoot;
  const latestTitleRef = useRef(doc.title ?? '');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const { addLastFocus, restoreFocus } = useFocusStore();

  const closeEmojiPicker = () => {
    setIsEmojiPickerOpen(false);
    restoreFocus();
  };

  const onEmojiSelect = ({ native }: { native: string }) => {
    updateDocEmoji(doc.id, latestTitleRef.current, native);
    closeEmojiPicker();
  };

  const handleEmojiButtonClick = (
    event: MouseEvent<HTMLButtonElement> | MouseEvent<HTMLAnchorElement>,
  ) => {
    if (emoji) {
      updateDocEmoji(doc.id, latestTitleRef.current, '');
      return;
    }

    const today = new Date();
    const isAprilFools = today.getMonth() === 3 && today.getDate() === 1;
    if (isAprilFools) {
      updateDocEmoji(doc.id, latestTitleRef.current, '🐟');
      return;
    }

    event.stopPropagation();
    addLastFocus(event.currentTarget);
    setIsEmojiPickerOpen(true);
  };

  useEffect(() => {
    latestTitleRef.current = doc.title ?? '';
  }, [doc.title]);

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
            bottom: isDeletedDoc ? 'base' : undefined,
          }}
        >
          {isDeletedDoc && <AlertRestore doc={doc} />}
          {isOffline && <AlertOffline />}
        </Box>
        <Box $gap="sm">
          <Box $position="relative">
            {displayEmojiButton && (
              <Button
                className="--docs--doc-header-emoji-button"
                size="nano"
                onClick={handleEmojiButtonClick}
                aria-expanded={emoji ? undefined : isEmojiPickerOpen}
                aria-label={emoji ? t('Remove emoji') : t('Add emoji')}
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
                {emoji ? t('Remove emoji') : t('Add emoji')}
              </Button>
            )}
            {isEmojiPickerOpen && (
              <EmojiPicker
                emojiData={getEmojidata()}
                onClickOutside={closeEmojiPicker}
                onEmojiSelect={onEmojiSelect}
                withOverlay={true}
              />
            )}
          </Box>
          <DocTitle
            doc={doc}
            onTitleUpdate={(title) => {
              latestTitleRef.current = title;
            }}
          />
          <DocHeaderInfo doc={doc} />
        </Box>
        <HorizontalSeparator $margin={{ top: '24px' }} />
      </Box>
    </>
  );
};
