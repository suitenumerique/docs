import { ColDef } from 'ag-grid-community';
import { useState } from 'react';

export const useColumns = () => {
  const [colDefs, setColDefs] = useState<ColDef[]>();

  return { colDefs, setColDefs };
};

export const useRows = () => {
  const [rowData, setRowData] =
    useState<Record<string, string | number | boolean>[]>();

  return { rowData, setRowData };
};
