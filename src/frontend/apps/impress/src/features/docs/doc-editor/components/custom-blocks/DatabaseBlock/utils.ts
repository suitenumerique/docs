import { ColDef } from 'ag-grid-community';

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
