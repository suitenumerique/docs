import { Button, type ButtonProps } from '@gouvfr-lasuite/cunningham-react';
import React from 'react';

import { Icon } from '@/components';

export const ButtonCloseModal = (props: ButtonProps) => {
  return (
    <Button
      type="button"
      size="small"
      color="neutral"
      variant="tertiary"
      icon={
        <Icon
          iconName="close"
          className="material-icons-filled"
          $size="24px!important"
          $color="var(--c--contextuals--content--semantic--neutral--secondary)"
        />
      }
      {...props}
    />
  );
};
