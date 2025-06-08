import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';

interface EmojiPickerProps {
  categories: string[];
  custom: {
    name: string;
    id: string;
    emojis: string[];
  }[];
  onClickOutside: () => void;
  onEmojiSelect: ({ native }: { native: string }) => void;
}

export const EmojiPicker = ({
  categories,
  custom,
  onClickOutside,
  onEmojiSelect,
}: EmojiPickerProps) => {
  const { i18n } = useTranslation();

  return (
    <Box $position="absolute" $zIndex={1000} $margin="2rem 0 0 0">
      <Picker
        categories={categories}
        custom={custom}
        data={data}
        locale={i18n.resolvedLanguage}
        navPosition="none"
        onClickOutside={onClickOutside}
        onEmojiSelect={onEmojiSelect}
        previewPosition="none"
        skinTonePosition="none"
        theme="light"
      />
    </Box>
  );
};
