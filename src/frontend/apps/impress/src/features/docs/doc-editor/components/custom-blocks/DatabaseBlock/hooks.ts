import { ColDef } from 'ag-grid-community';
import { useState } from 'react';

import { DatabaseRow } from './types';

export const useColumns = () => {
  const [colDefs, setColDefs] = useState<ColDef[]>();

  return { colDefs, setColDefs };
};

export const useRows = () => {
  const [rowData, setRowData] = useState<DatabaseRow[]>();

  return { rowData, setRowData };
};
