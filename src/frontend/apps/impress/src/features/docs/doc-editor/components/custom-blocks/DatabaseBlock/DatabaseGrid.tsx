import {
  CellEditingStoppedEvent,
  ColDef,
  ColSpanParams,
  ICellRendererParams,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useMemo } from 'react';

import { Box } from '@/components';
import {
  ColumnType,
  useGristCrudColumns,
  useGristCrudRecords,
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
  const { updateRecords } = useGristCrudRecords();

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

  const addNewRowRow = useMemo(() => {
    const columnNames = getColumnNames(colDefs);
    const lastRow = rowData?.[rowData.length - 1];
    if (lastRow && Object.values(lastRow).length > 0) {
      const lastRowValue = Object.values(lastRow)[0];
      if (lastRowValue === ADD_NEW_ROW) {
        return;
      }
    }
    const addNewRow = createNewRow({ value: ADD_NEW_ROW, columnNames });

   return addNewRow;
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

  const onCellEditingStopped = useCallback(
    (event: CellEditingStoppedEvent<DatabaseRow, DatabaseRow>) => {
      const { oldValue, newValue, data } = event;

      if (data === undefined) {
        return;
      }
      const { id: rowId, ...updatedRow } = data;

      if (!(typeof rowId === 'number') || oldValue === newValue) {
        return;
      }

      void updateRecords(documentId, tableId, [
        { id: rowId, fields: updatedRow },
      ]);
    },
    // disable updateRecords
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, tableId],
  );

  return (
    <>
      <Box style={{ height: '100%', width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          domLayout="autoHeight"
          enableCellSpan={true}
          onCellEditingStopped={onCellEditingStopped}
          pinnedBottomRowData={[addNewRowRow]}
        />
      </Box>
      <AddButtonComponent addColumn={addColumn} />
    </>
  );
};
