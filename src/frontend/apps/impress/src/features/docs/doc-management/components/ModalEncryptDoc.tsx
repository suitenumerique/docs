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
import { encrypt } from '@/docs/doc-collaboration/encryption';
import { toBase64 } from '@/features/docs/doc-editor';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  useEncryptDoc,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useKeyboardAction } from '@/hooks';

interface ModalEncryptDocProps {
  doc: Doc;
  onClose: () => void;
  onSuccess?: (doc: Doc) => void;
}

export const ModalEncryptDoc = ({
  doc,
  onClose,
  onSuccess,
}: ModalEncryptDocProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider } = useProviderStore();

  const {
    mutate: encryptDoc,
    isError,
    error,
  } = useEncryptDoc({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
    options: {
      onSuccess: () => {
        onSuccess && onSuccess(doc);
        onClose();

        toast(t('The document has been encrypted.'), VariantType.SUCCESS, {
          duration: 4000,
        });
      },
    },
  });

  const keyboardAction = useKeyboardAction();

  const handleClose = () => {
    onClose();
  };

  const handleEncrypt = () => {
    if (!provider) {
      return;
    }

    const state = Y.encodeStateAsUpdate(provider.document);
    const encryptedContent = encrypt(state);

    encryptDoc({
      docId: doc.id,
      content: toBase64(encryptedContent),
      encryptedSymmetricKeyPerUser: {
        // TODO: list of current users
      },
    });
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleEncryptKeyDown = keyboardAction(handleEncrypt);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-encrypt-doc-title"
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
            onClick={handleEncrypt}
            onKeyDown={handleEncryptKeyDown}
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
            id="modal-encrypt-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Encrypt document')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the encrypt modal')}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-encrypt-doc">
        {!isError && (
          <Text
            $size="sm"
            $variation="secondary"
            $display="inline-block"
            as="p"
          >
            <br />
            TODO: warning about encryption
            <br />
            TODO: accesses for users without public key will be lost (list them)
            <br />
            TODO: if no public key for current user, provide an onboarding
            <br />
            TODO: if document public, tell it needs first to be private (add
            backend check too)
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
