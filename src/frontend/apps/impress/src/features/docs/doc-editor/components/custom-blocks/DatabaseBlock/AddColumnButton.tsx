import { Button, Input } from '@openfun/cunningham-react';

import { Box, DropButton, Text } from '@/components';

export const AddButtonComponent = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const onOpenChange = (isOpen: boolean) => {
    setIsOpen(isOpen);
  };

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
        <Input label="Column label"></Input>
        <Button
          size="small"
          onClick={() => {
            setIsOpen(false);
            console.log('Column added', isOpen);
          }}
          style={{ alignSelf: 'end', width: 'fit-content' }}
        >
          Valider
        </Button>
      </Box>
    </DropButton>
  );
};
