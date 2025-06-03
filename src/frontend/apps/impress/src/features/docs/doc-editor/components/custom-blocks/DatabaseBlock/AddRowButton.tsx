import { Button } from '@openfun/cunningham-react';
import { Dispatch, SetStateAction } from 'react';

import { useGristCrudRecords } from '@/features/grist/useGristCrudRecords';

import { DatabaseRow } from './types';
import { createNewRow } from './utils';

export const AddRowButton = ({
  columns,
  setRowData,
  documentId,
  tableId,
}: {
  documentId: string;
  tableId: string;
  columns: string[];
  setRowData: Dispatch<SetStateAction<DatabaseRow[] | undefined>>;
}) => {
  const { createRecords } = useGristCrudRecords();

  const addRow = () => {
    const newRow = createNewRow({ columnNames: columns });
    setRowData((prev: DatabaseRow[] | undefined) => {
      if (prev === undefined) {
        return [newRow];
      }
      const updatedRows = [...prev];
      // Insert at the second-to-last position
      updatedRows.splice(updatedRows.length - 1, 0, newRow);
      return updatedRows;
    });

    void createRecords(documentId, tableId, [{ fields: newRow }]);
  };

  const color = '#817E77';
  return (
    <Button
      color="tertiary-text"
      icon={
        <span style={{ color }} className="material-icons">
          add
        </span>
      }
      style={{
        color,
        fontSize: '12px',
        fontWeight: '400',
        left: '-12px',
        padding: 0,
        width: '100%',
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addRow();
      }}
    >
      new row
    </Button>
  );
};
