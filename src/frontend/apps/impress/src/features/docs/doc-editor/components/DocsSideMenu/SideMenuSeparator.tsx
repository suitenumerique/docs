import { SideMenuExtension } from '@blocknote/core/extensions';
import { useBlockNoteEditor, useExtensionState } from '@blocknote/react';

import { type BoxType, HorizontalSeparator } from '@/components';

import type { DocsBlockNoteEditor } from '../../types';

type BlockType = DocsBlockNoteEditor['document'][number]['type'];

type SideMenuSeparatorProps = {
  typeDisplay?: BlockType[];
  typeHide?: BlockType[];
} & BoxType;

export const SideMenuSeparator = ({
  typeDisplay,
  typeHide,
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

  if (typeHide && (blockType === undefined || typeHide.includes(blockType))) {
    return null;
  }

  return <HorizontalSeparator $margin={{ vertical: '3xs' }} {...props} />;
};
