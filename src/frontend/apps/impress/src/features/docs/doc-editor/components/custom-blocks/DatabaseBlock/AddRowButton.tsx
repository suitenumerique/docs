import { Button } from '@openfun/cunningham-react';

import { useColumns, useRows } from './hooks';
import { createNewRow } from './utils';

export const AddRowButton = () => {
  const { setRowData } = useRows();
  const { colDefs } = useColumns();

  const addRow = () => {
    const newRow = createNewRow('', colDefs);
    setRowData((prev) => {
      if (prev === undefined) {
        return [newRow];
      }
      return [...prev, newRow];
    });
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
