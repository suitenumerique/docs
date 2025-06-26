import { Button, Modal, ModalSize } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box } from '../Box';
import { Text } from '../Text';

export type AlertModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string | React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export const AlertModal = ({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel,
  cancelLabel,
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
