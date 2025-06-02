import { Button, Input } from '@openfun/cunningham-react';
import { useState } from 'react';

import { Box, DropButton, Text } from '@/components';

export const AddButtonComponent = ({
  addColumn,
  isOpen,
  setIsOpen,
}: {
  addColumn: (columnName: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const onOpenChange = (isOpen: boolean) => {
    setIsOpen(isOpen);
  };
  const [columnName, setColumnName] = useState('');

  return (
    <DropButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="add column"
      button={
        <Box style={{ padding: '0.25rem', gap: '16px' }} color="tertiary">
          <span className="material-icons">add</span>
        </Box>
      }
    >
      <Box style={{ padding: '10px', gap: '10px' }}>
        <Text $variation="600" $size="s" $weight="bold" $theme="greyscale">
          Ajouter une colonne
        </Text>
        <Input
          label="Column label"
          onChange={(event) => {
            setColumnName(event.target.value);
          }}
        ></Input>
        <Button
          size="small"
          onClick={() => {
            console.log('Column added', columnName, isOpen);
            if (columnName.trim() === '') {
              return;
            }
            addColumn(columnName);
          }}
          style={{ alignSelf: 'end', width: 'fit-content' }}
        >
          Valider
        </Button>
      </Box>
    </DropButton>
  );
};
