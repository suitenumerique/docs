import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Text } from '@/components';
import { Doc } from '@/docs/doc-management/';

import { useRestoreDocVersion } from '../api';
import { DocVersion } from '../types';

const ModalStyle = createGlobalStyle`
  .c__modal__title {
    margin-bottom: var(--c--globals--spacings--sm);
  }
`;

interface ModalConfirmationVersionProps {
  docId: Doc['id'];
  onClose: () => void;
  onSuccess: () => void;
  versionId: DocVersion['id'];
}

export const ModalConfirmationVersion = ({
  onClose,
  onSuccess,
  docId,
  versionId,
}: ModalConfirmationVersionProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();

  /**
   * The collaboration server undoes everything after this version and hands the
   * result to every open editor, this one included — so there is nothing to
   * apply here and nothing to reload.
   */
  const { mutate: restoreVersion, isPending } = useRestoreDocVersion({
    onSuccess: () => {
      toast(t('Version restored successfully'), VariantType.SUCCESS);
      onSuccess();
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-label={t('Warning')}
      rightActions={
        <>
          <Button
            aria-label={`${t('Cancel')} - ${t('Warning')}`}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={() => onClose()}
          >
            {t('Cancel')}
          </Button>
          <Button
            aria-label={t('Restore')}
            color="error"
            fullWidth
            disabled={isPending}
            onClick={() => restoreVersion({ docId, versionId })}
          >
            {t('Restore')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Text
          as="h1"
          $margin="0"
          id="modal-confirmation-version-title"
          $size="h6"
          $align="flex-start"
        >
          {t('Restoring an older version')}
        </Text>
      }
    >
      <ModalStyle />
      <Box className="--docs--modal-confirmation-version">
        <Box>
          <Text $variation="secondary" as="p" $margin="none">
            {t(
              "The current document will be replaced, but you'll still find it in the version history.",
            )}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};
