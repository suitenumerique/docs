import { SideMenuExtension } from '@blocknote/core/extensions';
import { useBlockNoteEditor, useExtensionState } from '@blocknote/react';

import { type BoxType, HorizontalSeparator } from '@/components';

import type { DocsBlockNoteEditor } from '../../types';

type SideMenuSeparatorProps = {
  typeDisplay?: 'table';
  typeHide?: 'codeBlock';
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

  if (
    typeDisplay &&
    (block === undefined ||
      block.type !== typeDisplay ||
      !editor.settings.tables.headers)
  ) {
    return null;
  }

  if (typeHide && (block === undefined || block.type === typeHide)) {
    return null;
  }

  return <HorizontalSeparator $margin={{ vertical: '3xs' }} {...props} />;
};
