import {
  ColSpanParams,
  ICellRendererParams,
  SizeColumnsToContentStrategy,
} from 'ag-grid-community';
import { Dispatch, SetStateAction } from 'react';

import { AddRowButton } from './AddRowButton';
import { DatabaseRow } from './types';

export const autoSizeStrategy: SizeColumnsToContentStrategy = {
  type: 'fitCellContents',
};

export const createNewRow = ({
  columnNames,
  value = undefined,
}: {
  value?: string;
  columnNames: string[] | undefined;
}) => {
  const addNewRow: DatabaseRow = {};
  columnNames?.forEach((name) => {
    if (name !== undefined) {
      addNewRow[name] = value;
    }
  });

  return addNewRow;
};

export const addRowCellRenderer = (
  params: ICellRendererParams<Record<string, string>>,
  columns: string[] | undefined,
  setRowData: Dispatch<SetStateAction<DatabaseRow[] | undefined>>,
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

export const newRowColSpan = (
  params: ColSpanParams<Record<string, string>>,
) => {
  const colsValues = params.data ?? {};
  const isNewRow = Object.values(colsValues)[0]?.includes('new');
  if (isNewRow) {
    return Object.keys(colsValues).length;
  }

  return 1;
};
