import { Button, type ButtonProps } from '@gouvfr-lasuite/cunningham-react';

import CloseIcon from '@/assets/icons/ui-kit/x-mark.svg';

export const ButtonCloseModal = (props: ButtonProps) => {
  return (
    <Button
      type="button"
      size="small"
      color="neutral"
      variant="tertiary"
      icon={<CloseIcon width="24" height="24" aria-hidden="true" />}
      {...props}
    />
  );
};
