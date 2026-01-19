import { EmojiMartData } from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

export const PICKER_HEIGHT = 500;

interface EmojiPickerProps {
  emojiData: EmojiMartData;
  onClickOutside: () => void;
  onEmojiSelect: ({ native }: { native: string }) => void;
  withOverlay?: boolean;
  onEscape?: () => void;
}

export const EmojiPicker = ({
  emojiData,
  onClickOutside,
  onEmojiSelect,
  withOverlay = false,
  onEscape,
}: EmojiPickerProps) => {
  const { i18n } = useTranslation();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (onEscape) {
        onEscape();
      } else {
        onClickOutside();
      }
    }
  };

  const pickerContent = (
    <Box $position="absolute" $zIndex={1000} onKeyDownCapture={handleKeyDown}>
      <Picker
        data={emojiData}
        locale={i18n.resolvedLanguage}
        autoFocus
        onClickOutside={onClickOutside}
        onEmojiSelect={onEmojiSelect}
        previewPosition="none"
        skinTonePosition="none"
      />
    </Box>
  );

  if (withOverlay) {
    return (
      <>
        {/* Overlay transparent pour fermer en cliquant à l'extérieur */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999,
            backgroundColor: 'transparent',
          }}
          onClick={onClickOutside}
        />
        {pickerContent}
      </>
    );
  }

  return pickerContent;
};
