import { Button, type ButtonProps } from '@openfun/cunningham-react';
import React from 'react';

import { Icon } from '@/components';

export const ButtonCloseModal = (props: ButtonProps) => {
  return (
    <Button
      type="button"
      size="small"
      color="brand"
      variant="tertiary"
      icon={
        <Icon
          $withThemeInherited
          iconName="close"
          className="material-icons-filled"
        />
      }
      {...props}
    />
  );
};
