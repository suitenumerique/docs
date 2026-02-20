import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { ReactNode, useEffect } from 'react';
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

  /**
   * TODO:
   * Remove this effect when Cunningham will have this patch released:
   * https://github.com/suitenumerique/cunningham/pull/377
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      const contents = document.querySelectorAll('.c__modal__content');
      contents.forEach((content) => {
        content.setAttribute('tabindex', '-1');
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

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
        <Box $direction="row" $gap="small">
          <Button
            aria-label={`${t('Cancel')} - ${title}`}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={onClose}
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
        </Box>
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
