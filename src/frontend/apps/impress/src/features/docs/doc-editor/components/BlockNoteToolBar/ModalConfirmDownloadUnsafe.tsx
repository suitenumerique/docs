import { Button, Modal, ModalSize } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';

interface ModalConfirmDownloadUnsafeProps {
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
}

export const ModalConfirmDownloadUnsafe = ({
  onConfirm,
  onClose,
}: ModalConfirmDownloadUnsafeProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-describedby="modal-confirm-download-unsafe-title"
      rightActions={
        <>
          <Button
            aria-label={t('Cancel the download')}
            color="secondary"
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Download')}
            color="danger"
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
          $variation="1000"
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
            <Text $variation="700">{t('This file is flagged as unsafe.')}</Text>
            <Text $variation="600">
              {t('Please download it only if it comes from a trusted source.')}
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
