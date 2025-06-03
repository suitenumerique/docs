import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useEffect } from 'react';

import { Box } from '@/components';
import {
  ColumnType,
  useGristCrudColumns,
  useGristTableData,
} from '@/features/grist';

import { AddButtonComponent } from './AddColumnButton';
import { useColumns, useRows } from './hooks';
import { DatabaseRow } from './types';
import { addRowCellRenderer, createNewRow, newRowColSpan } from './utils';

export const DatabaseGrid = ({
  documentId,
  tableId,
}: {
  documentId: string;
  tableId: string;
}) => {
  const { tableData } = useGristTableData({
    documentId,
    tableId,
  });

  const { createColumns } = useGristCrudColumns();

  const { rowData, setRowData } = useRows();
  const { colDefs, setColDefs } = useColumns();

  useEffect(() => {
    const filteredEntries = Object.entries(tableData).filter(
      ([key]) => key !== 'id' && key !== 'manualSort',
    );

    const rowData1: DatabaseRow[] = [];

    const numRows = filteredEntries[0]?.[1].length;

    for (let i = 0; i < numRows; i++) {
      const row: DatabaseRow = {};
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

    setColDefs(columns);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData]);

  useEffect(() => {
    const columnNames = (colDefs ?? [])
      .map((col) => col.field)
      .filter((col) => col !== undefined);
    const addNewRow = createNewRow({ value: '+ new  row', columnNames });
    setRowData((prev) => [...(prev ? prev : []), addNewRow]);
  }, [colDefs, setRowData]);

  const defaultColDef = {
    flex: 1,
    filter: true,
    editable: true,
    unSortIcon: true,
    minWidth: 200,
  };

  const addColumn = (columnName: string) => {
    const newColDef: ColDef = {
      field: columnName,
    };

    setColDefs((prev) => {
      const addColumn = prev?.pop();

      return [
        ...(prev ?? []),
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
    <>
      <Box style={{ height: '100%', width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          domLayout="autoHeight"
          enableCellSpan={true}
        />
      </Box>
      <AddButtonComponent addColumn={addColumn} />
    </>
  );
};
