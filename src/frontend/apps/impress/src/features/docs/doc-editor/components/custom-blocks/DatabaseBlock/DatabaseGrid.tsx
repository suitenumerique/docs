import { ColDef, ColSpanParams, ICellRendererParams } from 'ag-grid-community';
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
import {
  ADD_NEW_ROW,
  addRowCellRenderer,
  createNewRow,
  defaultColDef,
  getColumnNames,
  newRowColSpan,
} from './utils';

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
      ([key]) => key !== 'manualSort',
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
      hide: key === 'id',
      colSpan: (params: ColSpanParams<Record<string, string>, unknown>) =>
        newRowColSpan(params, columnNames.length + 1),
      cellRendererSelector: (
        params: ICellRendererParams<Record<string, string>>,
      ) =>
        addRowCellRenderer({
          params,
          columnNames,
          setRowData,
          documentId,
          tableId,
        }),
    }));

    setColDefs(columns);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData]);

  useEffect(() => {
    const columnNames = getColumnNames(colDefs);
    const lastRow = rowData?.[rowData.length - 1];
    if (lastRow && Object.values(lastRow).length > 0) {
      const lastRowValue = Object.values(lastRow)[0];
      if (lastRowValue === ADD_NEW_ROW) {
        return;
      }
    }
    const addNewRow = createNewRow({ value: ADD_NEW_ROW, columnNames });
    setRowData((prev) => [...(prev ? prev : []), addNewRow]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colDefs]);

  const addColumn = (columnName: string) => {
    const columnNames = getColumnNames(colDefs);
    const newColDef: ColDef = {
      field: columnName,
      colSpan: (params: ColSpanParams<Record<string, string>, unknown>) =>
        newRowColSpan(params, columnNames.length + 1),
      cellRendererSelector: (
        params: ICellRendererParams<Record<string, string>>,
      ) =>
        addRowCellRenderer({
          documentId,
          tableId,
          params,
          columnNames,
          setRowData,
        }),
    };

    setColDefs((prev) => {
      return [...(prev !== undefined ? prev : []), newColDef];
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
