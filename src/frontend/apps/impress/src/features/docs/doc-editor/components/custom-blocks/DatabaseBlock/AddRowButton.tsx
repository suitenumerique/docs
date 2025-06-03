import { Button } from '@openfun/cunningham-react';
import { CustomCellRendererProps } from 'ag-grid-react';

export const AddRowButton = (props: CustomCellRendererProps) => {
  console.log('AddRowButton props', props);
  return (
    <Button
      color="tertiary-text"
      icon={<span className="material-icons">add</span>}
    >
      new row
    </Button>
  );
};
