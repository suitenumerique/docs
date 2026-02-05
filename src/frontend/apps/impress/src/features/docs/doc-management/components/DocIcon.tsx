import { MouseEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  BoxButton,
  BoxButtonType,
  EmojiPicker,
  PICKER_HEIGHT,
  Text,
  TextType,
  emojidata,
} from '@/components';
import { useRestoreFocus } from '@/hooks';

import { useDocTitleUpdate } from '../hooks/useDocTitleUpdate';

type DocIconProps = TextType & {
  buttonProps?: BoxButtonType;
  emoji?: string | null;
  defaultIcon: React.ReactNode;
  docId?: string;
  title?: string;
  onEmojiUpdate?: (emoji: string) => void;
  withEmojiPicker?: boolean;
};

export const DocIcon = ({
  buttonProps,
  emoji,
  defaultIcon,
  $size = 'sm',
  $variation = 'secondary',
  $weight = '400',
  docId,
  title,
  onEmojiUpdate,
  withEmojiPicker = false,
  ...textProps
}: DocIconProps) => {
  const { updateDocEmoji } = useDocTitleUpdate();
  const { t } = useTranslation();
  const restoreFocus = useRestoreFocus();

  const iconRef = useRef<HTMLDivElement>(null);

  const [openEmojiPicker, setOpenEmojiPicker] = useState<boolean>(false);
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  if (!withEmojiPicker && !emoji) {
    return defaultIcon;
  }

  const emojiLabel = withEmojiPicker
    ? emoji
      ? t('Edit document emoji')
      : t('Add emoji')
    : emoji
      ? t('Document emoji')
      : undefined;

  const toggleEmojiPicker = (e: MouseEvent) => {
    if (withEmojiPicker) {
      e.stopPropagation();
      e.preventDefault();

      if (!openEmojiPicker && iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();

        const pickerHeight = PICKER_HEIGHT;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Position picker above if not enough space below and enough space above
        const shouldPositionAbove =
          spaceBelow < pickerHeight && spaceAbove >= pickerHeight;

        // Offset to align the picker properly
        const ROW_OFFSET_TOP = 55;
        const ROW_OFFSET_BOTTOM = 10;

        setPickerPosition({
          top: shouldPositionAbove
            ? rect.top - pickerHeight + ROW_OFFSET_TOP
            : rect.bottom + ROW_OFFSET_BOTTOM,
          left: rect.left,
        });
      }

      setOpenEmojiPicker(!openEmojiPicker);
    }
  };

  const handleEmojiSelect = ({ native }: { native: string }) => {
    setOpenEmojiPicker(false);
    restoreFocus(iconRef);

    // Update document emoji if docId is provided
    if (docId && title !== undefined) {
      updateDocEmoji(docId, title ?? '', native);
    }

    // Call the optional callback
    onEmojiUpdate?.(native);
  };

  const handleClickOutside = () => {
    setOpenEmojiPicker(false);
    restoreFocus(iconRef);
  };

  return (
    <>
      <BoxButton
        className="--docs--doc-icon"
        ref={iconRef}
        onClick={toggleEmojiPicker}
        color="tertiary-text"
        aria-label={emojiLabel}
        title={emojiLabel}
        {...buttonProps}
      >
        {!emoji ? (
          defaultIcon
        ) : (
          <Text
            {...textProps}
            $size={$size}
            $variation={$variation}
            $weight={$weight}
            aria-hidden="true"
            data-testid="doc-emoji-icon"
          >
            {emoji}
          </Text>
        )}
      </BoxButton>
      {openEmojiPicker &&
        createPortal(
          <Box
            $position="fixed"
            $css={css`
              top: ${pickerPosition.top}px;
              left: ${pickerPosition.left}px;
              z-index: 1000;
            `}
          >
            <EmojiPicker
              emojiData={emojidata}
              onEmojiSelect={handleEmojiSelect}
              onClickOutside={handleClickOutside}
              withOverlay={true}
            />
          </Box>,
          document.body,
        )}
    </>
  );
};
