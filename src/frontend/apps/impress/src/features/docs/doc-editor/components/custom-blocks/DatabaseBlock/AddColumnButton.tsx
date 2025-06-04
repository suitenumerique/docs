import { Button, Input } from '@openfun/cunningham-react';
import { useState } from 'react';

import { Box, DropButton, Text } from '@/components';

export const AddButtonComponent = ({
  addColumn,
}: {
  addColumn: (columnName: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
  };
  const [columnName, setColumnName] = useState('');

  return (
    <DropButton
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="add column"
      buttonStyle={{ marginBottom: 'auto' }}
      button={
        <Box
          style={{
            padding: '0.25rem',
            gap: '16px',
            display: 'flex',
            marginTop: '8px',
          }}
          color="tertiary"
        >
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
            if (columnName.trim() === '') {
              return;
            }
            addColumn(columnName);
            setIsOpen(false);
          }}
          style={{ alignSelf: 'end', width: 'fit-content' }}
        >
          Valider
        </Button>
      </Box>
    </DropButton>
  );
};
