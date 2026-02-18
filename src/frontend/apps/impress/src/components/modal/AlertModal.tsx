import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
} from '@gouvfr-lasuite/cunningham-react';
import { ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useFocusOnMount } from '@/hooks';

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
  const cancelButtonRef = useRef<ButtonElement>(null);
  useFocusOnMount(cancelButtonRef, 100, isOpen);

  return (
    <Modal
      isOpen={isOpen}
      size={ModalSize.MEDIUM}
      onClose={onClose}
      aria-describedby="alert-modal-title"
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
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={`${t('Cancel')} - ${title}`}
            variant="secondary"
            fullWidth
            onClick={() => onClose()}
          >
            {cancelLabel ?? t('Cancel')}
          </Button>
          <Button
            aria-label={confirmLabel ?? t('Confirm')}
            color="error"
            onClick={onConfirm}
          >
            {confirmLabel ?? t('Confirm')}
          </Button>
        </>
      }
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
