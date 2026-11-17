import { blockHasType } from '@blocknote/core';
import { SideMenuExtension } from '@blocknote/core/extensions';
import { useBlockNoteEditor, useExtensionState } from '@blocknote/react';

import { type BoxType, HorizontalSeparator } from '@/components';

import type { DocsBlockNoteEditor } from '../../types';

type BlockType = DocsBlockNoteEditor['document'][number]['type'];

type SideMenuSeparatorProps = {
  typeDisplay?: BlockType[];
  hideWithoutColors?: boolean;
} & BoxType;

export const SideMenuSeparator = ({
  typeDisplay,
  hideWithoutColors,
  ...props
}: SideMenuSeparatorProps) => {
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  const blockType = block?.type as BlockType | undefined;

  if (
    typeDisplay &&
    (blockType === undefined ||
      !typeDisplay.includes(blockType) ||
      !editor.settings.tables.headers)
  ) {
    return null;
  }

  // Same check as BlockNote's BlockColorsItem, so the separator goes with "Colors"
  if (
    hideWithoutColors &&
    (block === undefined ||
      (!blockHasType(block, editor, block.type, { textColor: 'string' }) &&
        !blockHasType(block, editor, block.type, {
          backgroundColor: 'string',
        })))
  ) {
    return null;
  }

  return <HorizontalSeparator $margin={{ vertical: '3xs' }} {...props} />;
};
