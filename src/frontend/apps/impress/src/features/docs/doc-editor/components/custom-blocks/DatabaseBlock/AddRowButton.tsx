import { Button } from '@openfun/cunningham-react';
import { CustomCellRendererProps } from 'ag-grid-react';

export const AddRowButton = (props: CustomCellRendererProps) => {
  console.log('AddRowButton props', props);
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
    >
      new row
    </Button>
  );
};
