import { Button, type ButtonProps } from '@gouvfr-lasuite/ui-components';
import type { ComponentProps } from 'react';

import CloseIcon from '@/icons/x-mark.svg';

type ButtonCloseModalProps = ButtonProps & {
  iconProps?: Omit<ComponentProps<typeof CloseIcon>, 'children'>;
};

export const ButtonCloseModal = ({
  iconProps,
  ...props
}: ButtonCloseModalProps) => {
  return (
    <Button
      type="button"
      size="small"
      color="neutral"
      variant="tertiary"
      icon={
        <CloseIcon width="24" height="24" aria-hidden="true" {...iconProps} />
      }
      {...props}
    />
  );
};
