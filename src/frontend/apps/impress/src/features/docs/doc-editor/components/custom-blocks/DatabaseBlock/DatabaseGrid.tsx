import { ColDef, ColSpanParams, ICellRendererParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useEffect, useRef } from 'react';

import { Box } from '@/components';
import {
  ColumnType,
  useGristCrudColumns,
  useGristTableData,
} from '@/features/grist';

import { AddButtonComponent } from './AddColumnButton';
import { useColumns, useRows } from './hooks';
import { addRowCellRenderer, autoSizeStrategy, createNewRow } from './utils';

export const DatabaseGrid = ({
  documentId,
  tableId,
}: {
  documentId: string;
  tableId: string;
}) => {
  const gridRef = useRef(null);

  const { tableData } = useGristTableData({
    documentId,
    tableId,
  });

  const { createColumns } = useGristCrudColumns();

  const { rowData, setRowData } = useRows();
  const { colDefs, setColDefs } = useColumns();

  const newRowColSpan = (params: ColSpanParams<Record<string, string>>) => {
    const colsValues = params.data ?? {};
    const isNewRow = Object.values(colsValues)[0]?.includes('new');
    if (isNewRow) {
      return Object.keys(colsValues).length;
    }

    return 1;
  };

  const addColumnColDef: ColDef = {
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
  };

  useEffect(() => {
    const filteredEntries = Object.entries(tableData).filter(
      ([key]) => key !== 'id' && key !== 'manualSort',
    );

    const rowData1: Record<string, string | number | boolean>[] = [];

    const numRows = filteredEntries[0]?.[1].length;

    for (let i = 0; i < numRows; i++) {
      const row: Record<string, string | boolean | number> = {};
      for (const [key, values] of filteredEntries) {
        row[key] = values[i] ?? '';
      }
      rowData1.push(row);
    }

    setRowData(rowData1);

    const columnNames = Object.keys(Object.fromEntries(filteredEntries));

    const columns: ColDef[] = columnNames.map((key) => ({
      field: key,
      colSpan: newRowColSpan,
      cellRendererSelector: (
        params: ICellRendererParams<Record<string, string>>,
      ) => addRowCellRenderer(params, columnNames, setRowData),
    }));

    setColDefs(columns.concat(addColumnColDef));

    // Ignore addColumnColDef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData]);

  useEffect(() => {
    const columnNames = (colDefs ?? [])
      .map((col) => col.field)
      .filter((col) => col !== undefined);
    const addNewRow = createNewRow('+ new  row', columnNames);
    setRowData((prev) => [...(prev ? prev : []), addNewRow]);
  }, [colDefs, gridRef, setRowData]);

  const defaultColDef = {
    flex: 1,
    filter: true,
    editable: true,
    unSortIcon: true,
    suppressSizeToFit: true,
    minWidth: 200,
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

    void createColumns(documentId, tableId, [
      {
        id: columnName,
        fields: {
          label: columnName,
          type: ColumnType.TEXT,
        },
      },
    ]);
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
        autoSizeStrategy={autoSizeStrategy}
      />
    </Box>
  );
};
