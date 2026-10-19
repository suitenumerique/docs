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
import { useThreadStore } from '@/docs/doc-comments/stores/useThreadStore';
import { type Doc } from '@/docs/doc-management/';

import { useRestoreDocVersion } from '../api';
import { type DocVersion } from '../types';

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
  const { threadStore } = useThreadStore();

  /**
   * The collaboration server undoes everything after this version and hands the
   * result to every open editor, this one included — so there is nothing to
   * apply here and nothing to reload.
   */
  const { mutate: restoreVersion, isPending } = useRestoreDocVersion({
    onSuccess: () => {
      toast(
        t('Version restored successfully', {
          description: 'Toast shown after restoring an older version',
        }),
        VariantType.SUCCESS,
      );
      onSuccess();

      threadStore?.refreshThreads();
    },
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      aria-label={t('Warning', { description: 'Title of a warning dialog' })}
      rightActions={
        <>
          <Button
            aria-label={`${t('Cancel', { description: 'Button to dismiss a dialog without confirming' })} - ${t('Warning', { description: 'Title of a warning dialog' })}`}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={() => onClose()}
          >
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            aria-label={t('Restore', {
              description:
                'Button to restore a deleted document or an older version',
            })}
            color="error"
            fullWidth
            disabled={isPending}
            onClick={() => restoreVersion({ docId, versionId })}
          >
            {t('Restore', {
              description:
                'Button to restore a deleted document or an older version',
            })}
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
          {t('Restoring an older version', {
            description: 'Title of the dialog confirming restoring a version',
          })}
        </Text>
      }
    >
      <ModalStyle />
      <Box className="--docs--modal-confirmation-version">
        <Box>
          <Text $variation="secondary" as="p" $margin="none">
            {t(
              "The current document will be replaced, but you'll still find it in the version history.",
              { description: 'Explanation in the restore version dialog' },
            )}
          </Text>
        </Box>
      </Box>
    </Modal>
  );
};
