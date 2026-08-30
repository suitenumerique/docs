import { SideMenuExtension } from '@blocknote/core/extensions';
import { useBlockNoteEditor, useExtensionState } from '@blocknote/react';

import { HorizontalSeparator } from '@/components';

import type { DocsBlockNoteEditor } from '../../types';

export const TableHeaderSeparator = () => {
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  if (
    block === undefined ||
    block.type !== 'table' ||
    !editor.settings.tables.headers
  ) {
    return null;
  }

  return <HorizontalSeparator $margin={{ vertical: '3xs' }} />;
};
