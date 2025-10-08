import React from 'react';
import { createPortal } from 'react-dom';

import { Box, Icon, TextType } from '@/components';
import { EmojiPicker, emojidata } from '@/docs/doc-editor/';

import { useDocTitleUpdate } from '../hooks/useDocTitleUpdate';

type DocIconProps = TextType & {
  emoji?: string | null;
  withEmojiPicker?: boolean;
  defaultIcon: React.ReactNode;
  docId?: string;
  title?: string;
  onEmojiUpdate?: (emoji: string) => void;
};

export const DocIcon = ({
  emoji,
  withEmojiPicker = false,
  defaultIcon,
  $size = 'sm',
  $variation = '1000',
  $weight = '400',
  docId,
  title,
  onEmojiUpdate,
  ...textProps
}: DocIconProps) => {
  const { updateDocEmoji } = useDocTitleUpdate();

  const iconRef = React.useRef<HTMLDivElement>(null);

  const [openEmojiPicker, setOpenEmojiPicker] = React.useState<boolean>(false);
  const [pickerPosition, setPickerPosition] = React.useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  if (!withEmojiPicker && !emoji) {
    return defaultIcon;
  }

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    if (withEmojiPicker) {
      e.stopPropagation();
      e.preventDefault();

      if (!openEmojiPicker && iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        setPickerPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
        });
      }

      setOpenEmojiPicker(!openEmojiPicker);
    }
  };

  const handleEmojiSelect = ({ native }: { native: string }) => {
    setOpenEmojiPicker(false);

    // Update document emoji if docId is provided
    if (docId && title !== undefined) {
      updateDocEmoji(docId, title ?? '', native);
    }

    // Call the optional callback
    onEmojiUpdate?.(native);
  };

  const handleClickOutside = () => {
    setOpenEmojiPicker(false);
  };

  return (
    <>
      <Box ref={iconRef} onClick={toggleEmojiPicker} color="tertiary-text">
        {!emoji ? (
          defaultIcon
        ) : (
          <Icon
            {...textProps}
            iconName={emoji}
            $size={$size}
            $variation={$variation}
            $weight={$weight}
            aria-hidden="true"
            data-testid="doc-emoji-icon"
          >
            {emoji}
          </Icon>
        )}
      </Box>
      {openEmojiPicker &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: pickerPosition.top,
              left: pickerPosition.left,
              zIndex: 1000,
            }}
          >
            <EmojiPicker
              emojiData={emojidata}
              onEmojiSelect={handleEmojiSelect}
              onClickOutside={handleClickOutside}
              withOverlay={true}
            />
          </div>,
          document.body,
        )}
    </>
  );
};
