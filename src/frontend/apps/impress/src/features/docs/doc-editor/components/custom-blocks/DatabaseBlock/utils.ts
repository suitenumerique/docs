import { ColDef, ICellRendererParams } from 'ag-grid-community';

import { AddRowButton } from './AddRowButton';

export const createNewRow = (
  value: string | undefined,
  columns: ColDef[] | undefined,
) => {
  const defaultValue = value ?? '';
  const columnNames = columns?.map((col) => col.field);
  const addNewRow: Record<string, string> = {};
  columnNames?.forEach((name) => {
    if (name !== undefined) {
      addNewRow[name] = defaultValue;
    }
  });

  return addNewRow;
};

export const addRowCellRenderer = (
  params: ICellRendererParams<Record<string, string>>,
) => {
  if (params.data) {
    const addRowButton = {
      component: AddRowButton,
    };
    if (Object.values(params.data)[0]?.includes('new')) {
      return addRowButton;
    }
    return undefined;
  }
  return undefined;
};
