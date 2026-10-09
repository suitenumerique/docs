/**
 * Overrides the default SideMenu with a custom implementation for the Docs editor.
 * See: https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/SideMenu/SideMenu.tsx
 */
import type { Block } from '@blocknote/core';
import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  SideMenu,
  SideMenuController,
  useBlockNoteEditor,
  useExtensionState,
} from '@blocknote/react';
import { offset } from '@floating-ui/react';
import { useMemo } from 'react';

import type {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

import { DocsDragHandleMenu } from './DocsDragHandleMenu';

/**
 * Blocknote v0.54.0
 * See: https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/SideMenu/SideMenuController.tsx#L21
 *
 * Blocknote changed the way the side menu is positioned.
 * Because we are modifying the height of the heading blocks we need to adjust the offset of the side menu to match the
 * new height of the heading blocks.
 *
 * @todo Try to see with Blocknote if we can have a better way to handle this, maybe a prop to set the offset of the side menu.
 */
function getBlockOffset(
  editor: DocsBlockNoteEditor,
  block: Block<DocsBlockSchema, DocsInlineContentSchema, DocsStyleSchema>,
): number {
  if (block.type === 'heading') {
    switch (block.props.level) {
      case 1:
        return 13;
      case 2:
        return 7;
      case 3:
        return 4;
      default:
        return 0;
    }
  }

  // File blocks without a URL all render the same "Add file" button,
  // regardless of their type.
  if (
    editor.schema.blockSpecs[block.type]?.implementation.meta
      ?.fileBlockAccept &&
    (!('url' in block.props) || !block.props.url)
  ) {
    return 12;
  }

  if (block.type === 'file') {
    return 4;
  }

  if (block.type === 'audio' || block.type === 'table') {
    return 15;
  }

  return 0;
}

export const DocsSideMenu = () => {
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) =>
      state?.block as Block<
        DocsBlockSchema,
        DocsInlineContentSchema,
        DocsStyleSchema
      > | null,
  });

  const floatingUIOptions = useMemo(
    () => ({
      useFloatingOptions: {
        middleware: [
          offset({ crossAxis: block ? getBlockOffset(editor, block) : 0 }),
        ],
      },
    }),
    [editor, block],
  );

  return (
    <SideMenuController
      floatingUIOptions={floatingUIOptions}
      sideMenu={() => <SideMenu dragHandleMenu={DocsDragHandleMenu} />}
    />
  );
};
