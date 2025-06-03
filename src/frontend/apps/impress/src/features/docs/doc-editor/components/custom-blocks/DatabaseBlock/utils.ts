import {
  ICellRendererParams,
  SizeColumnsToContentStrategy,
} from 'ag-grid-community';
import { Dispatch, SetStateAction } from 'react';

import { AddRowButton } from './AddRowButton';

export const autoSizeStrategy: SizeColumnsToContentStrategy = {
  type: 'fitCellContents',
};

export const createNewRow = (
  value: string | undefined,
  columnNames: string[] | undefined,
) => {
  const defaultValue = value ?? '';
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
  columns: string[] | undefined,
  setRowData: Dispatch<
    SetStateAction<Record<string, string | number | boolean>[] | undefined>
  >,
) => {
  if (params.data) {
    const addRowButton = {
      component: AddRowButton,
      params: { columns, setRowData },
    };
    if (Object.values(params.data)[0]?.includes('new')) {
      return addRowButton;
    }
    return undefined;
  }
  return undefined;
};
