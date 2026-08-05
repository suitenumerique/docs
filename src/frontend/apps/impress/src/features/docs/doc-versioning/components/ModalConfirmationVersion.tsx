import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Text } from '@/components';
import { Doc } from '@/docs/doc-management/';

import { useDocVersion } from '../api';
import { Versions } from '../types';

const ModalStyle = createGlobalStyle`
  .c__modal__title {
    margin-bottom: var(--c--globals--spacings--sm);
  }
`;

interface ModalConfirmationVersionProps {
  docId: Doc['id'];
  onClose: () => void;
  onSuccess: () => void;
  versionId: Versions['version_id'];
}

export const ModalConfirmationVersion = ({
  onClose,
  onSuccess: __onSuccess,
  docId,
  versionId,
}: ModalConfirmationVersionProps) => {
  const { data: version } = useDocVersion({
    docId,
    versionId,
  });
  const { t } = useTranslation();

  // TODO(yhub) : Revert the doc to a previous state using Y.js / Yhub
  // const { mutate: updateDocContent } = useDocContentUpdate({
  //   listInvalidQueries: [KEY_LIST_DOC_VERSIONS],
  //   onSuccess: () => {
  //     const onDisplaySuccess = () => {
  //       toast(t('Version restored successfully'), VariantType.SUCCESS);
  //       onSuccess();
  //     };

  //     if (!provider || !version?.content) {
  //       onDisplaySuccess();
  //       return;
  //     }

  //     revertUpdate(provider.doc, provider.doc, base64ToYDoc(version.content));

  //     threadStore?.refreshThreads();

  //     onDisplaySuccess();
  //   },
  // });

  if (!version) {
    return null;
  }

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
            onClick={() => {
              if (!version?.content) {
                return;
              }

              onClose();
            }}
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
