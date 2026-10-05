import {
  Button,
  ButtonProps,
  Modal,
  ModalDefaultVariantProps,
  ModalSize,
} from '@gouvfr-lasuite/ui-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '../Box';
import { Text } from '../Text';

export type AlertModalProps = {
  description: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  themeCTA?: ButtonProps['color'];
  title: string;
  cancelLabel?: string;
  confirmLabel?: string;
} & Partial<ModalDefaultVariantProps>;

export const AlertModal = ({
  cancelLabel,
  confirmLabel,
  description,
  isOpen,
  onClose,
  onConfirm,
  title,
  themeCTA,
  ...props
}: AlertModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      closeOnClickOutside
      isOpen={isOpen}
      size={ModalSize.MEDIUM}
      onClose={onClose}
      aria-label={title}
      title={
        <Text
          $size="h6"
          as="h1"
          $margin="0"
          id="alert-modal-title"
          $align="flex-start"
        >
          {title}
        </Text>
      }
      rightActions={
        <Box $direction="row" $gap="small">
          <Button
            aria-label={`${t('Cancel', { description: 'Button to dismiss a dialog without confirming' })} - ${title}`}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={onClose}
          >
            {cancelLabel ??
              t('Cancel', {
                description: 'Button to dismiss a dialog without confirming',
              })}
          </Button>
          <Button
            aria-label={
              confirmLabel ??
              t('Confirm', { description: 'Button to validate a dialog' })
            }
            color={themeCTA ?? 'error'}
            onClick={onConfirm}
          >
            {confirmLabel ??
              t('Confirm', { description: 'Button to validate a dialog' })}
          </Button>
        </Box>
      }
      {...props}
    >
      <Box className="--docs--alert-modal">
        <Box>
          <Text $variation="secondary" as="p">
            {description}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};
