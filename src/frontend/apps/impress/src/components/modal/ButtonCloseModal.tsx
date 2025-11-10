import { Button, type ButtonProps } from '@openfun/cunningham-react';
import React from 'react';

import { Box } from '@/components';

export const ButtonCloseModal = (props: ButtonProps) => {
  return (
    <Button
      type="button"
      size="small"
      color="primary-text"
      icon={
        <Box as="span" aria-hidden="true" className="material-icons-filled">
          close
        </Box>
      }
      {...props}
    />
  );
};
