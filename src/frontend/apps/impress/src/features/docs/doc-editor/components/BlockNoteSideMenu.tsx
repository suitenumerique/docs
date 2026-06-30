import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useDictionary,
} from '@blocknote/react';

import { PresentBlockItem } from '@/docs/doc-presenter/components/PresentBlockItem';

const DocsDragHandleMenu = () => {
  const dict = useDictionary();

  return (
    <DragHandleMenu>
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <PresentBlockItem />
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
      <TableRowHeaderItem>
        {dict.drag_handle.header_row_menuitem}
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </DragHandleMenu>
  );
};

const DocsSideMenu = () => <SideMenu dragHandleMenu={DocsDragHandleMenu} />;

export const BlockNoteSideMenu = () => (
  <SideMenuController sideMenu={DocsSideMenu} />
);
