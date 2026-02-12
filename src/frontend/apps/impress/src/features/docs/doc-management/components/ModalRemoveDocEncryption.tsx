import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { toBase64 } from '@/features/docs/doc-editor';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useRemoveDocEncryption,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useKeyboardAction } from '@/hooks';

interface ModalRemoveDocEncryptionProps {
  doc: Doc;
  onClose: () => void;
  onSuccess?: (doc: Doc) => void;
}

export const ModalRemoveDocEncryption = ({
  doc,
  onClose,
  onSuccess,
}: ModalRemoveDocEncryptionProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider } = useProviderStore();

  const {
    mutate: removeDocEncryption,
    isError,
    error,
  } = useRemoveDocEncryption({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
    options: {
      onSuccess: () => {
        onSuccess && onSuccess(doc);
        onClose();

        toast(
          t('The document has been its encryption removed.'),
          VariantType.SUCCESS,
          {
            duration: 4000,
          },
        );
      },
    },
  });

  const keyboardAction = useKeyboardAction();

  const handleClose = () => {
    onClose();
  };

  const handleRemoveEncryption = () => {
    if (!provider) {
      return;
    }

    const state = Y.encodeStateAsUpdate(provider.document);

    removeDocEncryption({
      docId: doc.id,
      content: toBase64(state),
    });
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleRemoveEncryptionKeyDown = keyboardAction(handleRemoveEncryption);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-remove-doc-encryption-title"
      rightActions={
        <>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="error"
            fullWidth
            onClick={handleRemoveEncryption}
            onKeyDown={handleRemoveEncryptionKeyDown}
          >
            {t('Confirm')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $width="100%"
        >
          <Text
            $size="h6"
            as="h1"
            id="modal-remove-doc-encryption-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Remove document encryption')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the encryption removal modal')}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-remove-doc-encryption">
        {!isError && (
          <Text
            $size="sm"
            $variation="secondary"
            $display="inline-block"
            as="p"
          >
            <br />
            TODO: warning about removing encryption
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
