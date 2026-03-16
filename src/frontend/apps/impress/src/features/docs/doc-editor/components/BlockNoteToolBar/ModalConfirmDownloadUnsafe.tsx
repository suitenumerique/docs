import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
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
      aria-label={t('Warning')}
      rightActions={
        <>
          <Button
            aria-label={t('Cancel the download')}
            autoFocus
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
          as="h2"
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
      <Box className="--docs--modal-confirm-download-unsafe">
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
