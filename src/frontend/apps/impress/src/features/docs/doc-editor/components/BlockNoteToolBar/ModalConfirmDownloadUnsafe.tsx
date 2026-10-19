import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
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
      aria-label={t('Warning', { description: 'Title of a warning dialog' })}
      rightActions={
        <>
          <Button
            aria-label={t('Cancel the download', {
              description:
                'Accessible name of the button cancelling a download',
            })}
            autoFocus
            variant="secondary"
            onClick={() => onClose()}
          >
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            aria-label={t('Download', {
              description: 'Dropdown menu item to download the document',
            })}
            color="error"
            data-testid="modal-download-unsafe-button"
            onClick={() => {
              if (onConfirm) {
                void onConfirm();
              }
              onClose();
            }}
          >
            {t('Download anyway', {
              description: 'Button to download a file flagged as unsafe',
            })}
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
          {t('Warning', { description: 'Title of a warning dialog' })}
        </Text>
      }
    >
      <Box className="--docs--modal-confirm-download-unsafe">
        <Box>
          <Box $direction="column" $gap="0.35rem" $margin={{ top: 'sm' }}>
            <Text $variation="secondary">
              {t('This file is flagged as unsafe.', {
                description:
                  'Warning shown before downloading a file detected as malicious',
              })}
            </Text>
            <Text $variation="secondary">
              {t('Please download it only if it comes from a trusted source.', {
                description:
                  'Advice shown before downloading a file flagged as unsafe',
              })}
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
