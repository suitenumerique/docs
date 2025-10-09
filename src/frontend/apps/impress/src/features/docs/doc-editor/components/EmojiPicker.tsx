import { EmojiMartData } from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

interface EmojiPickerProps {
  emojiData: EmojiMartData;
  onClickOutside: () => void;
  onEmojiSelect: ({ native }: { native: string }) => void;
}

export const EmojiPicker = ({
  emojiData,
  onClickOutside,
  onEmojiSelect,
}: EmojiPickerProps) => {
  const { i18n } = useTranslation();

  return (
    <Box $position="absolute" $zIndex={1000} $margin="2rem 0 0 0">
      <Picker
        data={emojiData}
        locale={i18n.resolvedLanguage}
        onClickOutside={onClickOutside}
        onEmojiSelect={onEmojiSelect}
        previewPosition="none"
        skinTonePosition="none"
      />
    </Box>
  );
};
