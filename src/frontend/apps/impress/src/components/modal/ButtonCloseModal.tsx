import {
  Button,
  ButtonElement,
  type ButtonProps,
} from '@gouvfr-lasuite/cunningham-react';
import React, { forwardRef } from 'react';

import { Icon } from '@/components';

export const ButtonCloseModal = forwardRef<ButtonElement, ButtonProps>(
  (props, ref) => {
    return (
      <Button
        ref={ref}
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
  },
);

ButtonCloseModal.displayName = 'ButtonCloseModal';
