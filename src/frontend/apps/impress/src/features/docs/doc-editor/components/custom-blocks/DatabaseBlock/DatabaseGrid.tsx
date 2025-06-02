import { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useRef, useState } from 'react';

import { Box } from '@/components';

import { AddButtonComponent } from './AddColumnButton';

export const DatabaseGrid = () => {
  const gridRef = useRef(null);

  const [rowData, setRowData] = useState([
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
  ]);

  // Column Definitions: Defines the columns to be displayed.
  const [colDefs, setColDefs] = useState<ColDef[]>([
    { field: 'make', sort: 'desc' },
    {
      field: 'model',
    },
    { field: 'price' },
    { field: 'electric' },
    {
      headerComponentParams: {
        innerHeaderComponent: () =>
          AddButtonComponent({
            addColumn,
          }),
      },
      unSortIcon: false,
      editable: false,
      sortable: false,
      spanRows: true,
      filter: false,
    },
  ]);

  const defaultColDef = {
    flex: 1,
    filter: true,
    editable: true,
    unSortIcon: true,
  };

  const addColumn = (columnName: string) => {
    const newColDef: ColDef = {
      field: columnName,
    };

    setColDefs((prev) => {
      const addColumn = prev.pop();

      return [
        ...prev,
        newColDef,
        ...(addColumn !== undefined ? [addColumn] : []),
      ];
    });
  };

  return (
    <Box style={{ height: '100%', width: '100%' }}>
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        domLayout="autoHeight"
        enableCellSpan={true}
      />
    </Box>
  );
};
