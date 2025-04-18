import data from '@emoji-mart/data';
import { Picker, init } from 'emoji-mart';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RuleSet } from 'styled-components';

import { Box } from './Box';

export interface Emoji {
  id: string;
  name: string;
  native: string;
  unified: string;
  keywords: string[];
  shortcodes: string;
  skin: number;
}

export interface EmojiDataCategory {
  name: string;
  id?: string;
  emojis: string[];
}

export interface EmojiPickerProps {
  onEmojiSelect: (e: Emoji) => void;
  onClickOutside: (e: React.MouseEvent) => void;
  customCategory: EmojiDataCategory;
  styleSheet?: string | RuleSet<object>;
}

let categories = [
  'people',
  'nature',
  'foods',
  'activity',
  'places',
  'flags',
  'objects',
  'symbols',
];

export const EmojiPicker = ({
  onEmojiSelect,
  onClickOutside,
  customCategory,
  styleSheet,
}: EmojiPickerProps) => {
  const ref = useRef(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const initPicker = async () => {
      customCategory.name = t(customCategory.name);
      await init({ data: data, custom: [customCategory] });
      const { id } = customCategory;
      if (!categories.includes(id)) {
        categories = [id, ...categories];
      }

      new Picker({
        data,
        custom: [customCategory],
        categories: categories,
        onEmojiSelect: onEmojiSelect,
        onClickOutside: onClickOutside,

        locale: i18n.resolvedLanguage,
        previewPosition: 'none',
        navPosition: 'none',
        skinTonePosition: 'none',
        theme: 'light',

        ref,
      });
    };

    initPicker();
  }, []);

  return (
    <Box
      $position="absolute"
      $zIndex="100"
      $margin="2rem 0 0 0"
      $css={styleSheet}
      ref={ref}
    />
  );
};
