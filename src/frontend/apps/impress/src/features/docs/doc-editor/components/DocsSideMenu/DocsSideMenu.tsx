/**
 * Overrides the default DragHandleMenu with a custom implementation for the Docs editor.
 * See: https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/components/SideMenu/DragHandleMenu/DragHandleMenu.tsx
 */
import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useComponentsContext,
  useDictionary,
} from '@blocknote/react';

import { Box, HorizontalSeparator } from '@/components';
import { PresentBlockItem } from '@/docs/doc-presenter/components/PresentBlockItem';
import ColorIcon from '@/icons/color.svg';
import TableHeaderColumnIcon from '@/icons/table-header-column.svg';
import TableHeaderRowIcon from '@/icons/table-header-row.svg';
import TrashIcon from '@/icons/trash.svg';

import { TableHeaderSeparator } from './TableHeaderSeparator';

const DocsDragHandleMenu = () => {
  const Components = useComponentsContext();
  const dict = useDictionary();

  if (Components === undefined) {
    return null;
  }

  return (
    <DragHandleMenu>
      <BlockColorsItem>
        <Box $align="center" $gap="xxs" $direction="row">
          <ColorIcon width="16" height="16" aria-hidden="true" />
          {dict.drag_handle.colors_menuitem}
        </Box>
      </BlockColorsItem>
      <HorizontalSeparator $margin={{ vertical: '3xs' }} />
      <PresentBlockItem />
      <TableHeaderSeparator />
      <TableRowHeaderItem>
        <Box $align="center" $gap="xxs" $direction="row">
          <TableHeaderRowIcon width="16" height="16" aria-hidden="true" />
          {dict.drag_handle.header_row_menuitem}
        </Box>
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        <Box $align="center" $gap="xxs" $direction="row">
          <TableHeaderColumnIcon width="16" height="16" aria-hidden="true" />
          {dict.drag_handle.header_column_menuitem}
        </Box>
      </TableColumnHeaderItem>
      <HorizontalSeparator $margin={{ vertical: '3xs' }} />
      <RemoveBlockItem>
        <Box $align="center" $gap="xxs" $direction="row">
          <TrashIcon width="16" height="16" aria-hidden="true" />
          {dict.drag_handle.delete_menuitem}
        </Box>
      </RemoveBlockItem>
    </DragHandleMenu>
  );
};

export const DocsSideMenu = () => (
  <SideMenuController
    sideMenu={() => <SideMenu dragHandleMenu={DocsDragHandleMenu} />}
  />
);
