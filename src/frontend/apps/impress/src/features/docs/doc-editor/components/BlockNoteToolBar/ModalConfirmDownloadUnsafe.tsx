import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
} from '@gouvfr-lasuite/cunningham-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { useFocusOnMount } from '@/hooks';

interface ModalConfirmDownloadUnsafeProps {
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
}

export const ModalConfirmDownloadUnsafe = ({
  onConfirm,
  onClose,
}: ModalConfirmDownloadUnsafeProps) => {
  const { t } = useTranslation();
  const cancelButtonRef = useRef<ButtonElement>(null);
  useFocusOnMount(cancelButtonRef);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-describedby="modal-confirm-download-unsafe-title"
      rightActions={
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={t('Cancel the download')}
            variant="secondary"
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Download')}
            color="error"
            data-testid="modal-download-unsafe-button"
            onClick={() => {
              if (onConfirm) {
                void onConfirm();
              }
              onClose();
            }}
          >
            {t('Download anyway')}
          </Button>
        </>
      }
      size={ModalSize.SMALL}
      title={
        <Text
          as="h1"
          id="modal-confirm-download-unsafe-title"
          $gap="0.7rem"
          $size="h6"
          $align="flex-start"
          $direction="row"
          $margin="0"
        >
          <Icon iconName="warning" $theme="warning" />
          {t('Warning')}
        </Text>
      }
    >
      <Box
        aria-label={t('Modal confirmation to download the attachment')}
        className="--docs--modal-confirm-download-unsafe"
      >
        <Box>
          <Box $direction="column" $gap="0.35rem" $margin={{ top: 'sm' }}>
            <Text $variation="secondary">
              {t('This file is flagged as unsafe.')}
            </Text>
            <Text $variation="secondary">
              {t('Please download it only if it comes from a trusted source.')}
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
