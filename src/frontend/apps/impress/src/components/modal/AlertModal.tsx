import { Button, Modal, ModalSize } from '@openfun/cunningham-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '../Box';
import { Text } from '../Text';

export type AlertModalProps = {
  description: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  cancelLabel?: string;
  confirmLabel?: string;
};

export const AlertModal = ({
  cancelLabel,
  confirmLabel,
  description,
  isOpen,
  onClose,
  onConfirm,
  title,
}: AlertModalProps) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={isOpen}
      size={ModalSize.MEDIUM}
      onClose={onClose}
      title={
        <Text $size="h6" $align="flex-start" $variation="1000">
          {title}
        </Text>
      }
      rightActions={
        <>
          <Button
            aria-label={t('Close the modal')}
            color="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {cancelLabel ?? t('Cancel')}
          </Button>
          <Button
            aria-label={confirmLabel ?? t('Confirm')}
            color="danger"
            onClick={onConfirm}
          >
            {confirmLabel ?? t('Confirm')}
          </Button>
        </>
      }
    >
      <Box
        aria-label={t('Confirmation button')}
        className="--docs--alert-modal"
      >
        <Box>
          <Text $variation="600">{description}</Text>
        </Box>
      </Box>
    </Modal>
  );
};
