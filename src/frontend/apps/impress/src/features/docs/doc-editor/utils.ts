import { userColorsForId } from '@/features/auth/userColors';

import { DocsBlockNoteEditor } from './types';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const getWordCount = (editor?: DocsBlockNoteEditor): number => {
  const doc = editor?._tiptapEditor?.state.doc;
  const text = doc ? doc.textBetween(0, doc.content.size, '\n') : '';
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export const sanitizeColor = (color: string): string => {
  return HEX_COLOR_REGEX.test(color)
    ? color
    : userColorsForId('anonymous').color;
};
