import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  BlockColorsItem,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
} from '@blocknote/react';
import { useTranslation } from 'react-i18next';

import { getContentSlideIndexForBlock } from '@/docs/doc-presenter/hooks/useSlides';
import { usePresenterStore } from '@/docs/doc-presenter/stores';
import type { PresenterBlock } from '@/docs/doc-presenter/types';
import { useResponsiveStore } from '@/stores';

import type { DocsBlockNoteEditor } from '../types';

const PresentBlockItem = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });
  const openPresenter = usePresenterStore((state) => state.open);
  const { isMobile } = useResponsiveStore();

  // Hidden on mobile (no presenter there) and until a block is targeted
  // (no drag handle hovered yet).
  if (Components === undefined || block === undefined || isMobile) {
    return null;
  }

  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const contentSlideIndex = getContentSlideIndexForBlock(
          editor.document as PresenterBlock[],
          block.id,
        );

        // Overlay slide 0 is the generated title slide; content slides start
        // at index 1, hence the +1 on the 0-based content-slide index.
        openPresenter(contentSlideIndex + 1);
      }}
    >
      {t('Present')}
    </Components.Generic.Menu.Item>
  );
};

const DocsDragHandleMenu = () => {
  const Components = useComponentsContext();
  const dict = useDictionary();

  if (Components === undefined) {
    return null;
  }

  return (
    <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-drag-handle-menu">
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <PresentBlockItem />
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
      <TableRowHeaderItem>
        {dict.drag_handle.header_row_menuitem}
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </Components.Generic.Menu.Dropdown>
  );
};

const DocsSideMenu = () => <SideMenu dragHandleMenu={DocsDragHandleMenu} />;

export const BlockNoteSideMenu = () => (
  <SideMenuController sideMenu={DocsSideMenu} />
);
